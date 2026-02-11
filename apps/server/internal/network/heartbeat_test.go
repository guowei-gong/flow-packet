package network

import (
	"sync/atomic"
	"testing"
	"time"

	"github.com/flow-packet/server/internal/codec"
)

func TestHeartbeatSendInterval(t *testing.T) {
	cfg := HeartbeatConfig{
		Enable:   true,
		Interval: 50 * time.Millisecond,
		Timeout:  500 * time.Millisecond,
	}
	hb := NewHeartbeat(cfg, codec.DefaultPacketConfig())

	var sendCount int32
	hb.OnSend(func(data []byte) error {
		atomic.AddInt32(&sendCount, 1)
		return nil
	})

	hb.Start()
	defer hb.Stop()

	// 等待约 3 个心跳间隔
	time.Sleep(180 * time.Millisecond)

	count := atomic.LoadInt32(&sendCount)
	// 在 180ms 内应发送 3 次（50ms, 100ms, 150ms）
	if count < 2 || count > 5 {
		t.Fatalf("sendCount = %d, expected 2-5 in 180ms with 50ms interval", count)
	}
}

func TestHeartbeatTimeout(t *testing.T) {
	cfg := HeartbeatConfig{
		Enable:   true,
		Interval: 30 * time.Millisecond,
		Timeout:  80 * time.Millisecond,
	}
	hb := NewHeartbeat(cfg, codec.DefaultPacketConfig())

	hb.OnSend(func(data []byte) error { return nil })

	timedOut := make(chan struct{})
	hb.OnTimeout(func() {
		close(timedOut)
	})

	hb.Start()

	// 不喂狗，等待超时
	select {
	case <-timedOut:
		// 超时回调触发成功
		if hb.Running() {
			t.Fatal("heartbeat should stop running after timeout")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for heartbeat timeout callback")
	}
}

func TestHeartbeatFeedPreventsTimeout(t *testing.T) {
	cfg := HeartbeatConfig{
		Enable:   true,
		Interval: 30 * time.Millisecond,
		Timeout:  80 * time.Millisecond,
	}
	hb := NewHeartbeat(cfg, codec.DefaultPacketConfig())

	hb.OnSend(func(data []byte) error { return nil })

	timedOut := make(chan struct{})
	hb.OnTimeout(func() {
		close(timedOut)
	})

	hb.Start()
	defer hb.Stop()

	// 持续喂狗 200ms，不应超时
	stopFeed := make(chan struct{})
	go func() {
		ticker := time.NewTicker(20 * time.Millisecond)
		defer ticker.Stop()
		for {
			select {
			case <-stopFeed:
				return
			case <-ticker.C:
				hb.Feed()
			}
		}
	}()

	// 等待 200ms，确认没有超时
	select {
	case <-timedOut:
		t.Fatal("heartbeat should not timeout when being fed")
	case <-time.After(200 * time.Millisecond):
		// 正确：没有超时
	}

	close(stopFeed)
}

func TestHeartbeatDisabled(t *testing.T) {
	cfg := HeartbeatConfig{
		Enable:   false,
		Interval: 10 * time.Millisecond,
		Timeout:  30 * time.Millisecond,
	}
	hb := NewHeartbeat(cfg, codec.DefaultPacketConfig())

	var sendCount int32
	hb.OnSend(func(data []byte) error {
		atomic.AddInt32(&sendCount, 1)
		return nil
	})

	hb.Start()
	time.Sleep(50 * time.Millisecond)

	if atomic.LoadInt32(&sendCount) != 0 {
		t.Fatal("heartbeat should not send when disabled")
	}
	if hb.Running() {
		t.Fatal("heartbeat should not be running when disabled")
	}
}

func TestHeartbeatStopBeforeTimeout(t *testing.T) {
	cfg := HeartbeatConfig{
		Enable:   true,
		Interval: 20 * time.Millisecond,
		Timeout:  60 * time.Millisecond,
	}
	hb := NewHeartbeat(cfg, codec.DefaultPacketConfig())

	hb.OnSend(func(data []byte) error { return nil })

	timedOut := false
	hb.OnTimeout(func() {
		timedOut = true
	})

	hb.Start()

	// 等一小段时间后停止
	time.Sleep(30 * time.Millisecond)
	hb.Stop()

	if hb.Running() {
		t.Fatal("heartbeat should not be running after Stop")
	}

	// 确认不会触发超时
	time.Sleep(100 * time.Millisecond)
	if timedOut {
		t.Fatal("heartbeat should not timeout after Stop")
	}
}

func TestHeartbeatSendsValidPacket(t *testing.T) {
	cfg := HeartbeatConfig{
		Enable:   true,
		Interval: 20 * time.Millisecond,
		Timeout:  500 * time.Millisecond,
	}
	packetCfg := codec.DefaultPacketConfig()
	hb := NewHeartbeat(cfg, packetCfg)

	received := make(chan []byte, 1)
	hb.OnSend(func(data []byte) error {
		cp := make([]byte, len(data))
		copy(cp, data)
		select {
		case received <- cp:
		default:
		}
		return nil
	})

	hb.Start()
	defer hb.Stop()

	select {
	case data := <-received:
		// 验证是有效的心跳包：size(4) + header(1) = 5 bytes
		if len(data) != 5 {
			t.Fatalf("heartbeat packet len = %d, want 5", len(data))
		}
		// header: h=1 (0x80)
		if data[4] != 0x80 {
			t.Fatalf("heartbeat header = 0x%02X, want 0x80", data[4])
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for heartbeat packet")
	}
}
