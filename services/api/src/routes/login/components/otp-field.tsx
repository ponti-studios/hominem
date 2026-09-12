import { otpField } from '../styles';

export function OtpField() {
  return (
    <div aria-label="One-time verification code" class={otpField.field} role="group">
      {Array.from({ length: 6 }, (_, index) => (
        <span class={otpField.tile} key={index} style={`--i: ${index}`}>
          <input
            aria-label={`Character ${index + 1} of 6`}
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            autoFocus={index === 0}
            class={otpField.input}
            data-otp-digit
            inputMode="numeric"
            maxLength={1}
            pattern="[0-9]"
            required
            type="text"
          />
        </span>
      ))}
    </div>
  );
}
