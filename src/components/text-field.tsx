import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

type TextFieldProps<T extends FieldValues> = Pick<
  TextInputProps,
  | 'autoComplete'
  | 'keyboardType'
  | 'secureTextEntry'
  | 'textContentType'
  | 'onSubmitEditing'
  | 'returnKeyType'
  | 'multiline'
> & {
  control: Control<T>;
  name: Path<T>;
  label: string;
};

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  ...inputProps
}: TextFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <View className="gap-1">
          <Text className="text-sm font-bold text-foreground">{label}</Text>
          <TextInput
            {...inputProps}
            autoCapitalize="none"
            autoCorrect={false}
            textAlignVertical={inputProps.multiline ? 'top' : undefined}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            accessibilityLabel={label}
            className={`rounded-xl border border-border bg-surface px-4 py-3 text-base text-foreground ${inputProps.multiline ? 'min-h-24' : ''}`}
          />
          {fieldState.error ? (
            <Text className="text-sm text-danger">{fieldState.error.message}</Text>
          ) : null}
        </View>
      )}
    />
  );
}
