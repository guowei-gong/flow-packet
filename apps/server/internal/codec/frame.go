package codec

import (
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"strings"
)

// FieldDef 描述帧中的一个字段
type FieldDef struct {
	Name    string `json:"name"`
	Bytes   int    `json:"bytes"`
	IsRoute bool   `json:"isRoute"`
	IsSeq   bool   `json:"isSeq"`
}

// FieldDrivenConfig 字段驱动编解码配置
type FieldDrivenConfig struct {
	Fields      []FieldDef
	SizeIndex   int   // size/len 字段的索引
	SeqIndex    int   // seq 字段的索引（-1 无）
	RouteFields []int // route 字段的索引列表
	HeaderSize  int   // 所有 header 字段（不含 payload body）的总字节数
	SizeBytes   int   // size 字段的字节数
}

// NewFieldDrivenConfig 根据字段定义构建配置，自动检测 size/seq/route 字段索引
func NewFieldDrivenConfig(fields []FieldDef) (*FieldDrivenConfig, error) {
	cfg := &FieldDrivenConfig{
		Fields:    fields,
		SizeIndex: -1,
		SeqIndex:  -1,
	}

	totalBytes := 0
	for i, f := range fields {
		name := strings.ToLower(f.Name)
		if name == "size" || name == "len" {
			cfg.SizeIndex = i
			cfg.SizeBytes = f.Bytes
		}
		if f.IsSeq {
			cfg.SeqIndex = i
		}
		if f.IsRoute {
			cfg.RouteFields = append(cfg.RouteFields, i)
		}
		totalBytes += f.Bytes
	}

	if cfg.SizeIndex < 0 {
		return nil, errors.New("field-driven config: no size/len field found")
	}

	cfg.HeaderSize = totalBytes
	return cfg, nil
}

// PacketConfig 协议帧配置
type PacketConfig struct {
	RouteBytes  int                // legacy Due: route 字段字节数
	SeqBytes    int                // legacy Due: seq 字段字节数
	FieldDriven *FieldDrivenConfig // 非 nil 时启用字段驱动模式
}

// IsFieldDriven 返回是否使用字段驱动模式
func (c PacketConfig) IsFieldDriven() bool {
	return c.FieldDriven != nil
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
// 字段驱动模式：按 FieldDrivenConfig 定义小端编码
// Legacy Due 模式: size(4B) + header(1B: h=0 + extcode) + route + seq + message data
func Encode(pkt *Packet, cfg PacketConfig) ([]byte, error) {
	if cfg.IsFieldDriven() {
		return fieldDrivenEncode(pkt, cfg.FieldDriven)
	}
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
	if cfg.IsFieldDriven() {
		return fieldDrivenDecodeBytes(data, cfg.FieldDriven)
	}
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
	if d.cfg.IsFieldDriven() {
		return d.decodeFieldDriven()
	}

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

// ---- 字段驱动模式（小端序）----

// putUintNLE 以小端序将 val 写入 buf 的前 n 字节
func putUintNLE(buf []byte, val uint32, n int) {
	switch n {
	case 1:
		buf[0] = byte(val)
	case 2:
		binary.LittleEndian.PutUint16(buf, uint16(val))
	case 4:
		binary.LittleEndian.PutUint32(buf, val)
	}
}

// readUintNLE 从 buf 中以小端序读取 n 字节
func readUintNLE(buf []byte, n int) uint32 {
	switch n {
	case 1:
		return uint32(buf[0])
	case 2:
		return uint32(binary.LittleEndian.Uint16(buf))
	case 4:
		return binary.LittleEndian.Uint32(buf)
	default:
		return 0
	}
}

// splitRouteToFields 将组合路由值拆分为各路由字段值
// 逆向前端 combineRoute：从右往左按字段字节数依次提取
func splitRouteToFields(route uint32, cfg *FieldDrivenConfig) map[int]uint32 {
	result := make(map[int]uint32)
	value := route
	for i := len(cfg.RouteFields) - 1; i >= 0; i-- {
		idx := cfg.RouteFields[i]
		f := cfg.Fields[idx]
		mask := uint32((1 << (f.Bytes * 8)) - 1)
		result[idx] = value & mask
		value >>= uint(f.Bytes * 8)
	}
	return result
}

// combineRouteFromFields 将各路由字段值组合为单一 uint32
func combineRouteFromFields(values map[int]uint32, cfg *FieldDrivenConfig) uint32 {
	var result uint32
	for _, idx := range cfg.RouteFields {
		f := cfg.Fields[idx]
		result = (result << uint(f.Bytes*8)) | (values[idx] & uint32((1<<(f.Bytes*8))-1))
	}
	return result
}

// fieldDrivenEncode 字段驱动编码（小端序）
// 帧格式：header fields（按字段定义）+ payload body
// size 字段的值 = payload body 的字节数
func fieldDrivenEncode(pkt *Packet, cfg *FieldDrivenConfig) ([]byte, error) {
	totalSize := cfg.HeaderSize + len(pkt.Data)
	buf := make([]byte, totalSize)

	routeValues := splitRouteToFields(pkt.Route, cfg)

	offset := 0
	for i, f := range cfg.Fields {
		var val uint32
		if i == cfg.SizeIndex {
			val = uint32(len(pkt.Data))
		} else if f.IsRoute {
			val = routeValues[i]
		} else if f.IsSeq {
			val = pkt.Seq
		}
		putUintNLE(buf[offset:], val, f.Bytes)
		offset += f.Bytes
	}

	// payload body
	copy(buf[offset:], pkt.Data)

	return buf, nil
}

// fieldDrivenDecodeBytes 从完整字节数组中解码一个字段驱动的数据包
func fieldDrivenDecodeBytes(data []byte, cfg *FieldDrivenConfig) (*Packet, error) {
	if len(data) < cfg.HeaderSize {
		return nil, fmt.Errorf("data too short: %d < %d", len(data), cfg.HeaderSize)
	}

	// 解析 header 字段
	routeValues := make(map[int]uint32)
	var seq uint32
	var sizeValue uint32

	offset := 0
	for i, f := range cfg.Fields {
		val := readUintNLE(data[offset:], f.Bytes)
		if i == cfg.SizeIndex {
			sizeValue = val
		} else if f.IsRoute {
			routeValues[i] = val
		} else if f.IsSeq {
			seq = val
		}
		offset += f.Bytes
	}

	if cfg.HeaderSize+int(sizeValue) > len(data) {
		return nil, fmt.Errorf("incomplete packet: need %d bytes, have %d", cfg.HeaderSize+int(sizeValue), len(data))
	}

	pkt := &Packet{
		Route: combineRouteFromFields(routeValues, cfg),
		Seq:   seq,
	}
	if sizeValue > 0 {
		pkt.Data = data[cfg.HeaderSize : cfg.HeaderSize+int(sizeValue)]
	}
	return pkt, nil
}

// decodeFieldDriven 字段驱动流式解码
func (d *Decoder) decodeFieldDriven() (*Packet, error) {
	cfg := d.cfg.FieldDriven

	// 1. 读取整个 header
	headerBuf := make([]byte, cfg.HeaderSize)
	if _, err := io.ReadFull(d.reader, headerBuf); err != nil {
		return nil, err
	}

	// 2. 从 header 中提取各字段值
	routeValues := make(map[int]uint32)
	var seq uint32
	var sizeValue uint32

	offset := 0
	for i, f := range cfg.Fields {
		val := readUintNLE(headerBuf[offset:], f.Bytes)
		if i == cfg.SizeIndex {
			sizeValue = val
		} else if f.IsRoute {
			routeValues[i] = val
		} else if f.IsSeq {
			seq = val
		}
		offset += f.Bytes
	}

	// 3. 读取 payload body
	var body []byte
	if sizeValue > 0 {
		body = make([]byte, sizeValue)
		if _, err := io.ReadFull(d.reader, body); err != nil {
			return nil, fmt.Errorf("read payload: %w", err)
		}
	}

	return &Packet{
		Route: combineRouteFromFields(routeValues, cfg),
		Seq:   seq,
		Data:  body,
	}, nil
}
