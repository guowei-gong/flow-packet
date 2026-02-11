package codec

import (
	"encoding/hex"
	"fmt"
	"math"

	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/dynamicpb"
)

// DynamicEncode 使用动态消息将字段值编码为 Protobuf 字节数组
// fields 是字段名 → 值的映射，值可以是基础类型、map[string]any（嵌套消息）、[]any（repeated）
func DynamicEncode(md protoreflect.MessageDescriptor, fields map[string]any) ([]byte, error) {
	msg := dynamicpb.NewMessage(md)

	if err := setMessageFields(msg, md, fields); err != nil {
		return nil, err
	}

	return proto.Marshal(msg)
}

// DynamicDecode 将 Protobuf 字节数组解码为 JSON 友好的 map
// 如果 md 为 nil，返回十六进制字符串
func DynamicDecode(data []byte, md protoreflect.MessageDescriptor) (map[string]any, error) {
	if md == nil {
		return map[string]any{
			"_hex": hex.EncodeToString(data),
		}, nil
	}

	msg := dynamicpb.NewMessage(md)
	if err := proto.Unmarshal(data, msg); err != nil {
		return nil, fmt.Errorf("unmarshal: %w", err)
	}

	return messageToMap(msg), nil
}

func setMessageFields(msg *dynamicpb.Message, md protoreflect.MessageDescriptor, fields map[string]any) error {
	for name, val := range fields {
		fd := md.Fields().ByName(protoreflect.Name(name))
		if fd == nil {
			return fmt.Errorf("unknown field %q in %s", name, md.FullName())
		}

		protoVal, err := toProtoValue(fd, val)
		if err != nil {
			return fmt.Errorf("field %q: %w", name, err)
		}

		if fd.IsList() {
			list := msg.NewField(fd).List()
			items, ok := val.([]any)
			if !ok {
				return fmt.Errorf("field %q: expected array, got %T", name, val)
			}
			for i, item := range items {
				elemVal, err := toProtoListElement(fd, item)
				if err != nil {
					return fmt.Errorf("field %q[%d]: %w", name, i, err)
				}
				list.Append(elemVal)
			}
			msg.Set(fd, protoreflect.ValueOfList(list))
		} else if fd.IsMap() {
			mapVal := msg.NewField(fd).Map()
			items, ok := val.(map[string]any)
			if !ok {
				return fmt.Errorf("field %q: expected map, got %T", name, val)
			}
			keyFd := fd.MapKey()
			valueFd := fd.MapValue()
			for k, v := range items {
				mapKey, err := toProtoScalar(keyFd, k)
				if err != nil {
					return fmt.Errorf("field %q map key %q: %w", name, k, err)
				}
				mapValue, err := toProtoMapValue(valueFd, v)
				if err != nil {
					return fmt.Errorf("field %q map value for key %q: %w", name, k, err)
				}
				mapVal.Set(mapKey.MapKey(), mapValue)
			}
			msg.Set(fd, protoreflect.ValueOfMap(mapVal))
		} else {
			msg.Set(fd, protoVal)
		}
	}
	return nil
}

func toProtoValue(fd protoreflect.FieldDescriptor, val any) (protoreflect.Value, error) {
	if fd.IsList() || fd.IsMap() {
		// handled in caller
		return protoreflect.Value{}, nil
	}

	switch fd.Kind() {
	case protoreflect.MessageKind, protoreflect.GroupKind:
		nested, ok := val.(map[string]any)
		if !ok {
			return protoreflect.Value{}, fmt.Errorf("expected map for message, got %T", val)
		}
		subMsg := dynamicpb.NewMessage(fd.Message())
		if err := setMessageFields(subMsg, fd.Message(), nested); err != nil {
			return protoreflect.Value{}, err
		}
		return protoreflect.ValueOfMessage(subMsg), nil
	default:
		return toProtoScalar(fd, val)
	}
}

func toProtoListElement(fd protoreflect.FieldDescriptor, val any) (protoreflect.Value, error) {
	switch fd.Kind() {
	case protoreflect.MessageKind, protoreflect.GroupKind:
		nested, ok := val.(map[string]any)
		if !ok {
			return protoreflect.Value{}, fmt.Errorf("expected map for message, got %T", val)
		}
		subMsg := dynamicpb.NewMessage(fd.Message())
		if err := setMessageFields(subMsg, fd.Message(), nested); err != nil {
			return protoreflect.Value{}, err
		}
		return protoreflect.ValueOfMessage(subMsg), nil
	default:
		return toProtoScalar(fd, val)
	}
}

func toProtoMapValue(fd protoreflect.FieldDescriptor, val any) (protoreflect.Value, error) {
	switch fd.Kind() {
	case protoreflect.MessageKind, protoreflect.GroupKind:
		nested, ok := val.(map[string]any)
		if !ok {
			return protoreflect.Value{}, fmt.Errorf("expected map for message, got %T", val)
		}
		subMsg := dynamicpb.NewMessage(fd.Message())
		if err := setMessageFields(subMsg, fd.Message(), nested); err != nil {
			return protoreflect.Value{}, err
		}
		return protoreflect.ValueOfMessage(subMsg), nil
	default:
		return toProtoScalar(fd, val)
	}
}

func toProtoScalar(fd protoreflect.FieldDescriptor, val any) (protoreflect.Value, error) {
	switch fd.Kind() {
	case protoreflect.BoolKind:
		b, ok := toBool(val)
		if !ok {
			return protoreflect.Value{}, fmt.Errorf("cannot convert %T to bool", val)
		}
		return protoreflect.ValueOfBool(b), nil

	case protoreflect.Int32Kind, protoreflect.Sint32Kind, protoreflect.Sfixed32Kind:
		n, ok := toInt64(val)
		if !ok {
			return protoreflect.Value{}, fmt.Errorf("cannot convert %T to int32", val)
		}
		return protoreflect.ValueOfInt32(int32(n)), nil

	case protoreflect.Int64Kind, protoreflect.Sint64Kind, protoreflect.Sfixed64Kind:
		n, ok := toInt64(val)
		if !ok {
			return protoreflect.Value{}, fmt.Errorf("cannot convert %T to int64", val)
		}
		return protoreflect.ValueOfInt64(n), nil

	case protoreflect.Uint32Kind, protoreflect.Fixed32Kind:
		n, ok := toUint64(val)
		if !ok {
			return protoreflect.Value{}, fmt.Errorf("cannot convert %T to uint32", val)
		}
		return protoreflect.ValueOfUint32(uint32(n)), nil

	case protoreflect.Uint64Kind, protoreflect.Fixed64Kind:
		n, ok := toUint64(val)
		if !ok {
			return protoreflect.Value{}, fmt.Errorf("cannot convert %T to uint64", val)
		}
		return protoreflect.ValueOfUint64(n), nil

	case protoreflect.FloatKind:
		f, ok := toFloat64(val)
		if !ok {
			return protoreflect.Value{}, fmt.Errorf("cannot convert %T to float", val)
		}
		return protoreflect.ValueOfFloat32(float32(f)), nil

	case protoreflect.DoubleKind:
		f, ok := toFloat64(val)
		if !ok {
			return protoreflect.Value{}, fmt.Errorf("cannot convert %T to double", val)
		}
		return protoreflect.ValueOfFloat64(f), nil

	case protoreflect.StringKind:
		s, ok := val.(string)
		if !ok {
			return protoreflect.Value{}, fmt.Errorf("cannot convert %T to string", val)
		}
		return protoreflect.ValueOfString(s), nil

	case protoreflect.BytesKind:
		switch v := val.(type) {
		case []byte:
			return protoreflect.ValueOfBytes(v), nil
		case string:
			b, err := hex.DecodeString(v)
			if err != nil {
				return protoreflect.Value{}, fmt.Errorf("invalid hex string: %w", err)
			}
			return protoreflect.ValueOfBytes(b), nil
		default:
			return protoreflect.Value{}, fmt.Errorf("cannot convert %T to bytes", val)
		}

	case protoreflect.EnumKind:
		n, ok := toInt64(val)
		if !ok {
			return protoreflect.Value{}, fmt.Errorf("cannot convert %T to enum", val)
		}
		return protoreflect.ValueOfEnum(protoreflect.EnumNumber(n)), nil

	default:
		return protoreflect.Value{}, fmt.Errorf("unsupported kind: %v", fd.Kind())
	}
}

// messageToMap 将动态消息转为 map[string]any
func messageToMap(msg *dynamicpb.Message) map[string]any {
	result := make(map[string]any)
	md := msg.Descriptor()
	fields := md.Fields()

	for i := 0; i < fields.Len(); i++ {
		fd := fields.Get(i)
		if !msg.Has(fd) {
			continue
		}

		val := msg.Get(fd)
		result[string(fd.Name())] = protoValueToAny(fd, val)
	}

	return result
}

func protoValueToAny(fd protoreflect.FieldDescriptor, val protoreflect.Value) any {
	if fd.IsMap() {
		return mapToAny(fd, val.Map())
	}
	if fd.IsList() {
		return listToAny(fd, val.List())
	}
	return scalarToAny(fd, val)
}

func mapToAny(fd protoreflect.FieldDescriptor, m protoreflect.Map) any {
	result := make(map[string]any)
	valueFd := fd.MapValue()
	m.Range(func(k protoreflect.MapKey, v protoreflect.Value) bool {
		key := fmt.Sprintf("%v", k.Value().Interface())
		result[key] = scalarToAny(valueFd, v)
		return true
	})
	return result
}

func listToAny(fd protoreflect.FieldDescriptor, list protoreflect.List) any {
	result := make([]any, list.Len())
	for i := 0; i < list.Len(); i++ {
		result[i] = scalarToAny(fd, list.Get(i))
	}
	return result
}

func scalarToAny(fd protoreflect.FieldDescriptor, val protoreflect.Value) any {
	switch fd.Kind() {
	case protoreflect.MessageKind, protoreflect.GroupKind:
		dm, ok := val.Message().Interface().(*dynamicpb.Message)
		if ok {
			return messageToMap(dm)
		}
		return nil
	case protoreflect.EnumKind:
		return int(val.Enum())
	case protoreflect.BoolKind:
		return val.Bool()
	case protoreflect.BytesKind:
		return hex.EncodeToString(val.Bytes())
	default:
		return val.Interface()
	}
}

// 类型转换辅助函数

func toBool(v any) (bool, bool) {
	switch val := v.(type) {
	case bool:
		return val, true
	default:
		return false, false
	}
}

func toInt64(v any) (int64, bool) {
	switch val := v.(type) {
	case int:
		return int64(val), true
	case int8:
		return int64(val), true
	case int16:
		return int64(val), true
	case int32:
		return int64(val), true
	case int64:
		return val, true
	case float64:
		return int64(val), true
	case float32:
		return int64(val), true
	default:
		return 0, false
	}
}

func toUint64(v any) (uint64, bool) {
	switch val := v.(type) {
	case uint:
		return uint64(val), true
	case uint8:
		return uint64(val), true
	case uint16:
		return uint64(val), true
	case uint32:
		return uint64(val), true
	case uint64:
		return val, true
	case int:
		return uint64(val), true
	case int64:
		return uint64(val), true
	case float64:
		return uint64(val), true
	default:
		return 0, false
	}
}

func toFloat64(v any) (float64, bool) {
	switch val := v.(type) {
	case float32:
		return float64(val), true
	case float64:
		return val, true
	case int:
		return float64(val), true
	case int64:
		return float64(val), true
	default:
		return math.NaN(), false
	}
}
