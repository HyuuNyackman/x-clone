import { Pressable, Text } from 'react-native';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline';
  disabled?: boolean;
};

export function Button({ label, onPress, variant = 'primary', disabled }: ButtonProps) {
  const container = variant === 'primary' ? 'bg-primary' : 'border border-border bg-transparent';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      className={`items-center rounded-full px-5 py-3 active:opacity-80 ${disabled ? 'opacity-50' : ''} ${container}`}
    >
      <Text
        className={`text-base font-bold ${variant === 'primary' ? 'text-white' : 'text-foreground'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
