package codec

import (
	"bytes"
	"encoding/binary"
	"io"
	"testing"
)

func TestEncodeDataPacket(t *testing.T) {
	cfg := DefaultPacketConfig() // route=2, seq=2
	pkt := &Packet{
		Route: 1001,
		Seq:   1,
		Data:  []byte{0x0A, 0x0B, 0x0C},
	}

	buf, err := Encode(pkt, cfg)
	if err != nil {
		t.Fatalf("Encode error: %v", err)
	}

	// size(4) + header(1) + route(2) + seq(2) + data(3) = 12
	// payload size = 1 + 2 + 2 + 3 = 8
	if len(buf) != 12 {
		t.Fatalf("buf len = %d, want 12", len(buf))
	}

	// 验证 size 字段
	size := binary.BigEndian.Uint32(buf[0:4])
	if size != 8 {
		t.Fatalf("size = %d, want 8", size)
	}

	// 验证 header: h=0, extcode=0
	if buf[4] != 0x00 {
		t.Fatalf("header = 0x%02X, want 0x00", buf[4])
	}

	// 验证 route
	route := binary.BigEndian.Uint16(buf[5:7])
	if route != 1001 {
		t.Fatalf("route = %d, want 1001", route)
	}

	// 验证 seq
	seq := binary.BigEndian.Uint16(buf[7:9])
	if seq != 1 {
		t.Fatalf("seq = %d, want 1", seq)
	}

	// 验证 data
	if !bytes.Equal(buf[9:], []byte{0x0A, 0x0B, 0x0C}) {
		t.Fatalf("data = %v, want [0A 0B 0C]", buf[9:])
	}
}

func TestEncodeHeartbeatPacket(t *testing.T) {
	pkt := &Packet{
		Heartbeat: true,
		ExtCode:   0,
	}

	buf, err := Encode(pkt, DefaultPacketConfig())
	if err != nil {
		t.Fatalf("Encode error: %v", err)
	}

	// size(4) + header(1) = 5
	if len(buf) != 5 {
		t.Fatalf("buf len = %d, want 5", len(buf))
	}

	// size = 1
	size := binary.BigEndian.Uint32(buf[0:4])
	if size != 1 {
		t.Fatalf("size = %d, want 1", size)
	}

	// header: h=1, extcode=0 → 0x80
	if buf[4] != 0x80 {
		t.Fatalf("header = 0x%02X, want 0x80", buf[4])
	}
}

func TestEncodeWithDifferentConfig(t *testing.T) {
	cfg := PacketConfig{RouteBytes: 4, SeqBytes: 1}
	pkt := &Packet{
		Route: 100000,
		Seq:   255,
		Data:  []byte{0xFF},
	}

	buf, err := Encode(pkt, cfg)
	if err != nil {
		t.Fatalf("Encode error: %v", err)
	}

	// size(4) + header(1) + route(4) + seq(1) + data(1) = 11
	if len(buf) != 11 {
		t.Fatalf("buf len = %d, want 11", len(buf))
	}

	// 验证 route (4 bytes)
	route := binary.BigEndian.Uint32(buf[5:9])
	if route != 100000 {
		t.Fatalf("route = %d, want 100000", route)
	}

	// 验证 seq (1 byte)
	if buf[9] != 255 {
		t.Fatalf("seq = %d, want 255", buf[9])
	}
}

func TestEncodeWithSeqZeroBytes(t *testing.T) {
	cfg := PacketConfig{RouteBytes: 2, SeqBytes: 0}
	pkt := &Packet{
		Route: 1001,
		Data:  []byte{0x01},
	}

	buf, err := Encode(pkt, cfg)
	if err != nil {
		t.Fatalf("Encode error: %v", err)
	}

	// size(4) + header(1) + route(2) + data(1) = 8
	if len(buf) != 8 {
		t.Fatalf("buf len = %d, want 8", len(buf))
	}
}

func TestEncodeInvalidConfig(t *testing.T) {
	pkt := &Packet{Route: 1}

	_, err := Encode(pkt, PacketConfig{RouteBytes: 3, SeqBytes: 2})
	if err == nil {
		t.Fatal("expected error for invalid RouteBytes")
	}

	_, err = Encode(pkt, PacketConfig{RouteBytes: 2, SeqBytes: 3})
	if err == nil {
		t.Fatal("expected error for invalid SeqBytes")
	}
}

func TestDecodeDataPacket(t *testing.T) {
	cfg := DefaultPacketConfig()
	pkt := &Packet{Route: 1001, Seq: 42, Data: []byte("hello")}

	encoded, _ := Encode(pkt, cfg)
	decoder := NewDecoder(bytes.NewReader(encoded), cfg)

	decoded, err := decoder.Decode()
	if err != nil {
		t.Fatalf("Decode error: %v", err)
	}

	if decoded.Heartbeat {
		t.Fatal("expected data packet, got heartbeat")
	}
	if decoded.Route != 1001 {
		t.Fatalf("route = %d, want 1001", decoded.Route)
	}
	if decoded.Seq != 42 {
		t.Fatalf("seq = %d, want 42", decoded.Seq)
	}
	if !bytes.Equal(decoded.Data, []byte("hello")) {
		t.Fatalf("data = %q, want %q", decoded.Data, "hello")
	}
}

func TestDecodeHeartbeatPacket(t *testing.T) {
	pkt := &Packet{Heartbeat: true, ExtCode: 3}
	encoded, _ := Encode(pkt, DefaultPacketConfig())

	decoder := NewDecoder(bytes.NewReader(encoded), DefaultPacketConfig())
	decoded, err := decoder.Decode()
	if err != nil {
		t.Fatalf("Decode error: %v", err)
	}

	if !decoded.Heartbeat {
		t.Fatal("expected heartbeat packet")
	}
	if decoded.ExtCode != 3 {
		t.Fatalf("extcode = %d, want 3", decoded.ExtCode)
	}
}

func TestDecodeStickyPackets(t *testing.T) {
	cfg := DefaultPacketConfig()

	// 编码两个包粘在一起
	pkt1 := &Packet{Route: 1001, Seq: 1, Data: []byte("a")}
	pkt2 := &Packet{Route: 1002, Seq: 2, Data: []byte("bb")}

	buf1, _ := Encode(pkt1, cfg)
	buf2, _ := Encode(pkt2, cfg)

	combined := append(buf1, buf2...)
	decoder := NewDecoder(bytes.NewReader(combined), cfg)

	// 解码第一个包
	d1, err := decoder.Decode()
	if err != nil {
		t.Fatalf("Decode pkt1 error: %v", err)
	}
	if d1.Route != 1001 || d1.Seq != 1 {
		t.Fatalf("pkt1: route=%d seq=%d, want 1001/1", d1.Route, d1.Seq)
	}

	// 解码第二个包
	d2, err := decoder.Decode()
	if err != nil {
		t.Fatalf("Decode pkt2 error: %v", err)
	}
	if d2.Route != 1002 || d2.Seq != 2 {
		t.Fatalf("pkt2: route=%d seq=%d, want 1002/2", d2.Route, d2.Seq)
	}
}

func TestDecodeSplitPacket(t *testing.T) {
	cfg := DefaultPacketConfig()
	pkt := &Packet{Route: 1001, Seq: 1, Data: []byte("test")}
	encoded, _ := Encode(pkt, cfg)

	// 使用管道模拟拆包（分次写入）
	pr, pw := io.Pipe()

	go func() {
		// 分两次写入
		pw.Write(encoded[:3]) // 先写前 3 字节
		pw.Write(encoded[3:]) // 再写剩余
		pw.Close()
	}()

	decoder := NewDecoder(pr, cfg)
	decoded, err := decoder.Decode()
	if err != nil {
		t.Fatalf("Decode error: %v", err)
	}

	if decoded.Route != 1001 {
		t.Fatalf("route = %d, want 1001", decoded.Route)
	}
	if !bytes.Equal(decoded.Data, []byte("test")) {
		t.Fatalf("data = %q, want %q", decoded.Data, "test")
	}
}

func TestDecodeInvalidPacket(t *testing.T) {
	// payload size = 0
	buf := make([]byte, 4)
	binary.BigEndian.PutUint32(buf, 0)
	decoder := NewDecoder(bytes.NewReader(buf), DefaultPacketConfig())
	_, err := decoder.Decode()
	if err == nil {
		t.Fatal("expected error for zero payload size")
	}
}

func TestDecodeEOF(t *testing.T) {
	decoder := NewDecoder(bytes.NewReader(nil), DefaultPacketConfig())
	_, err := decoder.Decode()
	if err != io.EOF {
		t.Fatalf("expected io.EOF, got %v", err)
	}
}
