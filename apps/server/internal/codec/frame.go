package codec

import (
	"encoding/binary"
	"errors"
	"fmt"
	"io"
)

// PacketConfig 协议帧配置
type PacketConfig struct {
	RouteBytes int // route 字段字节数: 1, 2, 4（默认 2）
	SeqBytes   int // seq 字段字节数: 0, 1, 2, 4（默认 2）
}

// DefaultPacketConfig 默认帧配置
func DefaultPacketConfig() PacketConfig {
	return PacketConfig{
		RouteBytes: 2,
		SeqBytes:   2,
	}
}

// headerSize size(4) + header(1) 固定部分长度
const headerSize = 5

// Packet 解析后的数据包
type Packet struct {
	Heartbeat bool   // 是否为心跳包（header 中 h=1）
	ExtCode   uint8  // 扩展操作码 (7 bits)
	Route     uint32 // 消息路由（仅数据包）
	Seq       uint32 // 消息序列号（仅数据包）
	Data      []byte // 消息体（数据包）或心跳时间（心跳包）
}

// IsHeartbeat 返回是否为心跳包
func (p *Packet) IsHeartbeat() bool {
	return p.Heartbeat
}

// Encode 将数据包编码为二进制帧
// 数据包格式: size(4B) + header(1B: h=0 + extcode) + route + seq + message data
// 心跳包格式: size(4B) + header(1B: h=1 + extcode)
func Encode(pkt *Packet, cfg PacketConfig) ([]byte, error) {
	if pkt.Heartbeat {
		return encodeHeartbeat(pkt)
	}
	return encodeData(pkt, cfg)
}

// encodeHeartbeat 编码心跳包
func encodeHeartbeat(pkt *Packet) ([]byte, error) {
	// size = header(1)
	payloadSize := 1
	buf := make([]byte, 4+payloadSize)

	// size（不包含 size 字段自身）
	binary.BigEndian.PutUint32(buf[0:4], uint32(payloadSize))

	// header: h=1 + extcode
	buf[4] = 0x80 | (pkt.ExtCode & 0x7F)

	return buf, nil
}

// encodeData 编码数据包
func encodeData(pkt *Packet, cfg PacketConfig) ([]byte, error) {
	if err := validateConfig(cfg); err != nil {
		return nil, err
	}

	// payload = header(1) + route + seq + data
	payloadSize := 1 + cfg.RouteBytes + cfg.SeqBytes + len(pkt.Data)
	buf := make([]byte, 4+payloadSize)

	// size（不包含 size 字段自身）
	binary.BigEndian.PutUint32(buf[0:4], uint32(payloadSize))

	// header: h=0 + extcode
	buf[4] = pkt.ExtCode & 0x7F

	offset := 5

	// route
	putUintN(buf[offset:], pkt.Route, cfg.RouteBytes)
	offset += cfg.RouteBytes

	// seq
	putUintN(buf[offset:], pkt.Seq, cfg.SeqBytes)
	offset += cfg.SeqBytes

	// message data
	copy(buf[offset:], pkt.Data)

	return buf, nil
}

// validateConfig 校验帧配置合法性
func validateConfig(cfg PacketConfig) error {
	switch cfg.RouteBytes {
	case 1, 2, 4:
	default:
		return fmt.Errorf("invalid RouteBytes: %d, must be 1, 2, or 4", cfg.RouteBytes)
	}
	switch cfg.SeqBytes {
	case 0, 1, 2, 4:
	default:
		return fmt.Errorf("invalid SeqBytes: %d, must be 0, 1, 2, or 4", cfg.SeqBytes)
	}
	return nil
}

// putUintN 以大端序将 val 写入 buf 的前 n 字节
func putUintN(buf []byte, val uint32, n int) {
	switch n {
	case 1:
		buf[0] = byte(val)
	case 2:
		binary.BigEndian.PutUint16(buf, uint16(val))
	case 4:
		binary.BigEndian.PutUint32(buf, val)
	}
}

// readUintN 从 buf 中以大端序读取 n 字节
func readUintN(buf []byte, n int) uint32 {
	switch n {
	case 1:
		return uint32(buf[0])
	case 2:
		return uint32(binary.BigEndian.Uint16(buf))
	case 4:
		return binary.BigEndian.Uint32(buf)
	default:
		return 0
	}
}

// DecodeBytes 从完整的字节数组中解码一个数据包
func DecodeBytes(data []byte, cfg PacketConfig) (*Packet, error) {
	if len(data) < headerSize {
		return nil, fmt.Errorf("data too short: %d < %d", len(data), headerSize)
	}

	payloadSize := binary.BigEndian.Uint32(data[0:4])
	if int(payloadSize)+4 > len(data) {
		return nil, fmt.Errorf("incomplete packet: need %d bytes, have %d", payloadSize+4, len(data))
	}

	payload := data[4 : 4+payloadSize]
	header := payload[0]
	isHeartbeat := (header & 0x80) != 0
	extCode := header & 0x7F

	pkt := &Packet{
		Heartbeat: isHeartbeat,
		ExtCode:   extCode,
	}

	if isHeartbeat {
		if len(payload) > 1 {
			pkt.Data = payload[1:]
		}
		return pkt, nil
	}

	offset := 1
	minSize := 1 + cfg.RouteBytes + cfg.SeqBytes
	if int(payloadSize) < minSize {
		return nil, fmt.Errorf("invalid data packet: payload size %d < minimum %d", payloadSize, minSize)
	}

	pkt.Route = readUintN(payload[offset:], cfg.RouteBytes)
	offset += cfg.RouteBytes

	if cfg.SeqBytes > 0 {
		pkt.Seq = readUintN(payload[offset:], cfg.SeqBytes)
		offset += cfg.SeqBytes
	}

	if offset < len(payload) {
		pkt.Data = payload[offset:]
	}

	return pkt, nil
}

// Decoder 协议帧解码器，从 io.Reader 中持续读取并解码帧
type Decoder struct {
	reader io.Reader
	cfg    PacketConfig
}

// NewDecoder 创建解码器
func NewDecoder(reader io.Reader, cfg PacketConfig) *Decoder {
	return &Decoder{reader: reader, cfg: cfg}
}

// Decode 从流中读取并解码下一个完整的数据包
func (d *Decoder) Decode() (*Packet, error) {
	// 1. 读取 size (4 bytes)
	sizeBuf := make([]byte, 4)
	if _, err := io.ReadFull(d.reader, sizeBuf); err != nil {
		return nil, err
	}
	payloadSize := binary.BigEndian.Uint32(sizeBuf)

	if payloadSize == 0 {
		return nil, errors.New("invalid packet: payload size is 0")
	}

	// 2. 读取整个 payload
	payload := make([]byte, payloadSize)
	if _, err := io.ReadFull(d.reader, payload); err != nil {
		return nil, fmt.Errorf("read payload: %w", err)
	}

	// 3. 解析 header
	header := payload[0]
	isHeartbeat := (header & 0x80) != 0
	extCode := header & 0x7F

	pkt := &Packet{
		Heartbeat: isHeartbeat,
		ExtCode:   extCode,
	}

	if isHeartbeat {
		// 心跳包：剩余数据为 heartbeat time（如有）
		if len(payload) > 1 {
			pkt.Data = payload[1:]
		}
		return pkt, nil
	}

	// 4. 数据包：解析 route + seq + message data
	offset := 1
	minSize := 1 + d.cfg.RouteBytes + d.cfg.SeqBytes
	if int(payloadSize) < minSize {
		return nil, fmt.Errorf("invalid data packet: payload size %d < minimum %d", payloadSize, minSize)
	}

	pkt.Route = readUintN(payload[offset:], d.cfg.RouteBytes)
	offset += d.cfg.RouteBytes

	if d.cfg.SeqBytes > 0 {
		pkt.Seq = readUintN(payload[offset:], d.cfg.SeqBytes)
		offset += d.cfg.SeqBytes
	}

	if offset < len(payload) {
		pkt.Data = payload[offset:]
	}

	return pkt, nil
}
