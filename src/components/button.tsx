import { Pressable, Text } from 'react-native';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline';
};

export function Button({ label, onPress, variant = 'primary' }: ButtonProps) {
  const container = variant === 'primary' ? 'bg-primary' : 'border border-border bg-transparent';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`items-center rounded-full px-5 py-3 active:opacity-80 ${container}`}
    >
      <Text
        className={`text-base font-bold ${variant === 'primary' ? 'text-white' : 'text-foreground'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
