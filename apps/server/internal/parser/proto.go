package parser

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/bufbuild/protocompile"
	"google.golang.org/protobuf/reflect/protoreflect"
)

// ParseResult 解析结果
type ParseResult struct {
	Files           []FileInfo                        // 按文件分组的 message 信息
	fileDescriptors []protoreflect.FileDescriptor     // 编译后的文件描述符（用于运行时查找）
}

// FileInfo 文件级别信息
type FileInfo struct {
	Path     string        // 文件路径
	Package  string        // package 名称
	Messages []MessageInfo // message 列表
	Enums    []EnumInfo    // 顶层 enum 列表
}

// MessageInfo 描述一个 Protobuf message
type MessageInfo struct {
	Name       string        // 全限定名称（package.MessageName）
	ShortName  string        // 短名称（MessageName）
	Fields     []FieldInfo   // 字段列表
	Oneofs     []OneofInfo   // oneof 组
	NestedMsgs []MessageInfo // 嵌套 message
	NestedEnums []EnumInfo   // 嵌套 enum
}

// FieldInfo 描述一个字段
type FieldInfo struct {
	Name       string `json:"name"`
	Number     int    `json:"number"`
	Type       string `json:"type"`       // 类型名称（int32, string, MessageName 等）
	Kind       string `json:"kind"`       // proto kind（message, enum, scalar 等）
	IsRepeated bool   `json:"isRepeated"` // 是否 repeated
	IsOptional bool   `json:"isOptional"` // 是否 optional
	IsMap      bool   `json:"isMap"`      // 是否 map 类型
	MapKey     string `json:"mapKey,omitempty"`   // map key 类型
	MapValue   string `json:"mapValue,omitempty"` // map value 类型
	OneofName  string `json:"oneofName,omitempty"` // 所属 oneof 名称
}

// OneofInfo 描述一个 oneof 组
type OneofInfo struct {
	Name   string   `json:"name"`
	Fields []string `json:"fields"` // 字段名列表
}

// EnumInfo 描述一个 enum 类型
type EnumInfo struct {
	Name   string          `json:"name"`
	Values []EnumValueInfo `json:"values"`
}

// EnumValueInfo 描述一个 enum 值
type EnumValueInfo struct {
	Name   string `json:"name"`
	Number int    `json:"number"`
}

// ParseProtoFiles 解析 .proto 文件列表，返回所有 message 定义
func ParseProtoFiles(paths []string) (*ParseResult, error) {
	if len(paths) == 0 {
		return &ParseResult{}, nil
	}

	// 收集所有 proto 文件所在的目录作为导入路径
	importPaths := collectImportPaths(paths)

	// 提取文件名（相对路径）
	fileNames := make([]string, len(paths))
	for i, p := range paths {
		fileNames[i] = filepath.Base(p)
	}

	// 创建 resolver
	resolver := &protocompile.SourceResolver{
		ImportPaths: importPaths,
	}

	compiler := &protocompile.Compiler{
		Resolver: protocompile.WithStandardImports(resolver),
	}

	compiled, err := compiler.Compile(context.Background(), fileNames...)
	if err != nil {
		return nil, fmt.Errorf("compile proto files: %w", err)
	}

	result := &ParseResult{}
	for _, fd := range compiled {
		fi := extractFileInfo(fd)
		result.Files = append(result.Files, fi)
		result.fileDescriptors = append(result.fileDescriptors, fd)
	}

	return result, nil
}

// ParseProtoDir 遍历 rootDir 目录树中所有 .proto 文件，以 rootDir 为 import path 统一编译。
// 同时将所有包含 .proto 文件的父目录也加入 import paths，
// 以兼容用户选择不同层级文件夹上传的情况。
func ParseProtoDir(rootDir string) (*ParseResult, error) {
	absRoot, err := filepath.Abs(rootDir)
	if err != nil {
		return nil, fmt.Errorf("resolve root dir: %w", err)
	}

	// 收集所有 .proto 文件的相对路径，以及它们的父目录
	var relPaths []string
	parentDirs := make(map[string]bool)
	err = filepath.Walk(absRoot, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && filepath.Ext(path) == ".proto" {
			rel, err := filepath.Rel(absRoot, path)
			if err != nil {
				return err
			}
			// protocompile 需要正斜杠路径
			relPaths = append(relPaths, filepath.ToSlash(rel))
			// 记录包含 .proto 的目录（绝对路径）
			parentDirs[filepath.Dir(path)] = true
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("walk proto dir: %w", err)
	}

	if len(relPaths) == 0 {
		return &ParseResult{}, nil
	}

	// 构建 import paths：rootDir 优先，再加上所有包含 .proto 的目录
	// 这样 import "source/X.proto" 既能从 rootDir 解析（source/ 是子目录），
	// 也能从 .proto 文件所在目录解析（用户直接选了子文件夹上传的情况）
	importPaths := []string{absRoot}
	for dir := range parentDirs {
		if dir != absRoot {
			importPaths = append(importPaths, dir)
		}
	}

	resolver := &protocompile.SourceResolver{
		ImportPaths: importPaths,
	}

	compiler := &protocompile.Compiler{
		Resolver: protocompile.WithStandardImports(resolver),
	}

	compiled, err := compiler.Compile(context.Background(), relPaths...)
	if err != nil {
		return nil, fmt.Errorf("compile proto dir: %w", err)
	}

	result := &ParseResult{}
	for _, fd := range compiled {
		fi := extractFileInfo(fd)
		result.Files = append(result.Files, fi)
		result.fileDescriptors = append(result.fileDescriptors, fd)
	}

	return result, nil
}

// ParseProtoReader 从 io.Reader 解析 proto 内容
func ParseProtoReader(name string, reader io.Reader) (*ParseResult, error) {
	content, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("read proto content: %w", err)
	}

	// 使用内存中的 accessor
	accessor := func(filename string) (io.ReadCloser, error) {
		if filename == name {
			return io.NopCloser(
				&bytesReader{data: content, pos: 0},
			), nil
		}
		return nil, os.ErrNotExist
	}

	resolver := &protocompile.SourceResolver{
		Accessor: accessor,
	}

	compiler := &protocompile.Compiler{
		Resolver: protocompile.WithStandardImports(resolver),
	}

	compiled, err := compiler.Compile(context.Background(), name)
	if err != nil {
		return nil, fmt.Errorf("compile proto: %w", err)
	}

	result := &ParseResult{}
	for _, fd := range compiled {
		fi := extractFileInfo(fd)
		result.Files = append(result.Files, fi)
		result.fileDescriptors = append(result.fileDescriptors, fd)
	}

	return result, nil
}

// FindMessageDescriptor 根据全限定名称查找 MessageDescriptor
func (r *ParseResult) FindMessageDescriptor(fullName string) protoreflect.MessageDescriptor {
	name := protoreflect.FullName(fullName)
	for _, fd := range r.fileDescriptors {
		msgs := fd.Messages()
		if md := findMsgInDescriptors(msgs, name); md != nil {
			return md
		}
	}
	return nil
}

func findMsgInDescriptors(msgs protoreflect.MessageDescriptors, name protoreflect.FullName) protoreflect.MessageDescriptor {
	for i := 0; i < msgs.Len(); i++ {
		md := msgs.Get(i)
		if md.FullName() == name {
			return md
		}
		// 检查嵌套 message
		if nested := findMsgInDescriptors(md.Messages(), name); nested != nil {
			return nested
		}
	}
	return nil
}

// AllMessages 返回解析结果中所有 message（扁平化，包含嵌套）
func (r *ParseResult) AllMessages() []MessageInfo {
	var all []MessageInfo
	for _, f := range r.Files {
		all = append(all, flattenMessages(f.Messages)...)
	}
	return all
}

func flattenMessages(msgs []MessageInfo) []MessageInfo {
	var result []MessageInfo
	for _, m := range msgs {
		result = append(result, m)
		result = append(result, flattenMessages(m.NestedMsgs)...)
	}
	return result
}

func collectImportPaths(paths []string) []string {
	dirs := make(map[string]bool)
	for _, p := range paths {
		abs, err := filepath.Abs(p)
		if err != nil {
			continue
		}
		dirs[filepath.Dir(abs)] = true
	}
	result := make([]string, 0, len(dirs))
	for d := range dirs {
		result = append(result, d)
	}
	return result
}

func extractFileInfo(fd protoreflect.FileDescriptor) FileInfo {
	fi := FileInfo{
		Path:    string(fd.Path()),
		Package: string(fd.Package()),
	}

	// 提取顶层 message
	msgs := fd.Messages()
	for i := 0; i < msgs.Len(); i++ {
		fi.Messages = append(fi.Messages, extractMessageInfo(msgs.Get(i)))
	}

	// 提取顶层 enum
	enums := fd.Enums()
	for i := 0; i < enums.Len(); i++ {
		fi.Enums = append(fi.Enums, extractEnumInfo(enums.Get(i)))
	}

	return fi
}

func extractMessageInfo(md protoreflect.MessageDescriptor) MessageInfo {
	mi := MessageInfo{
		Name:      string(md.FullName()),
		ShortName: string(md.Name()),
	}

	// 提取字段
	fields := md.Fields()
	for i := 0; i < fields.Len(); i++ {
		fi := extractFieldInfo(fields.Get(i))
		mi.Fields = append(mi.Fields, fi)
	}

	// 提取 oneof 组
	oneofs := md.Oneofs()
	for i := 0; i < oneofs.Len(); i++ {
		oo := oneofs.Get(i)
		// 跳过 proto3 optional 生成的合成 oneof
		if oo.IsSynthetic() {
			continue
		}
		oi := OneofInfo{
			Name: string(oo.Name()),
		}
		ooFields := oo.Fields()
		for j := 0; j < ooFields.Len(); j++ {
			oi.Fields = append(oi.Fields, string(ooFields.Get(j).Name()))
		}
		mi.Oneofs = append(mi.Oneofs, oi)
	}

	// 嵌套 message
	nested := md.Messages()
	for i := 0; i < nested.Len(); i++ {
		nm := nested.Get(i)
		// 跳过 map entry message
		if nm.IsMapEntry() {
			continue
		}
		mi.NestedMsgs = append(mi.NestedMsgs, extractMessageInfo(nm))
	}

	// 嵌套 enum
	enums := md.Enums()
	for i := 0; i < enums.Len(); i++ {
		mi.NestedEnums = append(mi.NestedEnums, extractEnumInfo(enums.Get(i)))
	}

	return mi
}

func extractFieldInfo(fd protoreflect.FieldDescriptor) FieldInfo {
	fi := FieldInfo{
		Name:       string(fd.Name()),
		Number:     int(fd.Number()),
		IsRepeated: fd.IsList(),
		IsOptional: fd.HasOptionalKeyword(),
		IsMap:      fd.IsMap(),
	}

	// 类型名称
	switch fd.Kind() {
	case protoreflect.MessageKind:
		fi.Kind = "message"
		fi.Type = string(fd.Message().FullName())
	case protoreflect.EnumKind:
		fi.Kind = "enum"
		fi.Type = string(fd.Enum().FullName())
	default:
		fi.Kind = "scalar"
		fi.Type = fd.Kind().String()
	}

	// Map 类型信息
	if fd.IsMap() {
		fi.IsRepeated = false // map 不标记为 repeated
		mapEntry := fd.Message()
		keyField := mapEntry.Fields().ByName("key")
		valueField := mapEntry.Fields().ByName("value")
		if keyField != nil {
			fi.MapKey = keyField.Kind().String()
		}
		if valueField != nil {
			if valueField.Kind() == protoreflect.MessageKind {
				fi.MapValue = string(valueField.Message().FullName())
			} else if valueField.Kind() == protoreflect.EnumKind {
				fi.MapValue = string(valueField.Enum().FullName())
			} else {
				fi.MapValue = valueField.Kind().String()
			}
		}
	}

	// oneof 组名
	if od := fd.ContainingOneof(); od != nil && !od.IsSynthetic() {
		fi.OneofName = string(od.Name())
	}

	return fi
}

func extractEnumInfo(ed protoreflect.EnumDescriptor) EnumInfo {
	ei := EnumInfo{
		Name: string(ed.FullName()),
	}
	values := ed.Values()
	for i := 0; i < values.Len(); i++ {
		v := values.Get(i)
		ei.Values = append(ei.Values, EnumValueInfo{
			Name:   string(v.Name()),
			Number: int(v.Number()),
		})
	}
	return ei
}

// bytesReader 实现 io.Reader
type bytesReader struct {
	data []byte
	pos  int
}

func (r *bytesReader) Read(p []byte) (int, error) {
	if r.pos >= len(r.data) {
		return 0, io.EOF
	}
	n := copy(p, r.data[r.pos:])
	r.pos += n
	return n, nil
}
