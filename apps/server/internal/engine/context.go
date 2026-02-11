package engine

import (
	"fmt"
	"sync"
	"time"
)

// SeqContext seq 分配与响应匹配
type SeqContext struct {
	mu      sync.Mutex
	counter uint32
	pending map[uint32]chan []byte
}

// NewSeqContext 创建 seq 上下文
func NewSeqContext() *SeqContext {
	return &SeqContext{
		pending: make(map[uint32]chan []byte),
	}
}

// NextSeq 分配下一个 seq 并注册等待通道
func (c *SeqContext) NextSeq() (uint32, chan []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.counter++
	seq := c.counter
	ch := make(chan []byte, 1)
	c.pending[seq] = ch
	return seq, ch
}

// Resolve 收到响应后，通过 seq 匹配到等待方
func (c *SeqContext) Resolve(seq uint32, data []byte) bool {
	c.mu.Lock()
	ch, ok := c.pending[seq]
	if ok {
		delete(c.pending, seq)
	}
	c.mu.Unlock()

	if !ok {
		return false
	}

	ch <- data
	return true
}

// WaitResponse 等待指定 seq 的响应，超时返回错误
func (c *SeqContext) WaitResponse(ch chan []byte, timeout time.Duration) ([]byte, error) {
	select {
	case data := <-ch:
		return data, nil
	case <-time.After(timeout):
		return nil, fmt.Errorf("response timeout")
	}
}

// Reset 重置上下文
func (c *SeqContext) Reset() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.counter = 0
	for seq, ch := range c.pending {
		close(ch)
		delete(c.pending, seq)
	}
}
