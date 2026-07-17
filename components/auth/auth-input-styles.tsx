export function AuthInputStyles() {
  return (
    <style>{`
      .auth-input {
        width: 100%;
        background: rgb(28 25 23 / 0.8);
        border: 1px solid rgb(255 255 255 / 0.1);
        border-radius: 0.75rem;
        padding: 0.65rem 0.9rem;
        font-size: 0.875rem;
        color: #f5f5f4;
        outline: none;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      .auth-input::placeholder { color: #57534e; }
      .auth-input:focus {
        border-color: oklch(0.7 0.2 47 / 0.5);
        box-shadow: 0 0 0 3px oklch(0.7 0.2 47 / 0.12);
      }
    `}</style>
  );
}
