import { forwardRef, useId } from "react";

const Input = forwardRef(function Input(
  {
    label,
    name,
    type = "text",
    error = "",
    hint = "",
    required = false,
    disabled = false,
    className = "",
    wrapperClassName = "",
    id,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const inputId = id || `${name || "input"}-${generatedId}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  const describedBy = [
    hint ? hintId : "",
    error ? errorId : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label
      htmlFor={inputId}
      className={wrapperClassName}
    >
      {label ? (
        <span>
          {label}
          {required ? (
            <span aria-hidden="true"> *</span>
          ) : null}
        </span>
      ) : null}

      <input
        ref={ref}
        id={inputId}
        name={name}
        type={type}
        required={required}
        disabled={disabled}
        className={className}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        {...props}
      />

      {hint && !error ? (
        <small id={hintId}>
          {hint}
        </small>
      ) : null}

      {error ? (
        <small
          id={errorId}
          className="form-error"
          role="alert"
        >
          {error}
        </small>
      ) : null}
    </label>
  );
});

export default Input;
