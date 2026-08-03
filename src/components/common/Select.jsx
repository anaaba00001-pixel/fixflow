import { forwardRef, useId } from "react";

const Select = forwardRef(function Select(
  {
    label,
    name,
    options = [],
    placeholder = "اختر من القائمة",
    error = "",
    hint = "",
    required = false,
    disabled = false,
    className = "",
    wrapperClassName = "",
    id,
    value,
    defaultValue,
    onChange,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const selectId = id || `${name || "select"}-${generatedId}`;
  const errorId = `${selectId}-error`;
  const hintId = `${selectId}-hint`;

  const describedBy = [
    hint ? hintId : "",
    error ? errorId : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label htmlFor={selectId} className={wrapperClassName}>
      {label ? (
        <span>
          {label}
          {required ? <span aria-hidden="true"> *</span> : null}
        </span>
      ) : null}

      <select
        ref={ref}
        id={selectId}
        name={name}
        required={required}
        disabled={disabled}
        className={className}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        value={value}
        defaultValue={value === undefined ? defaultValue ?? "" : undefined}
        onChange={onChange}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled={required}>
            {placeholder}
          </option>
        ) : null}

        {options.map((option) => {
          const normalizedOption =
            typeof option === "string"
              ? {
                  value: option,
                  label: option,
                }
              : option;

          return (
            <option
              key={normalizedOption.value}
              value={normalizedOption.value}
              disabled={Boolean(normalizedOption.disabled)}
            >
              {normalizedOption.label}
            </option>
          );
        })}
      </select>

      {hint && !error ? <small id={hintId}>{hint}</small> : null}

      {error ? (
        <small id={errorId} className="form-error" role="alert">
          {error}
        </small>
      ) : null}
    </label>
  );
});

export default Select;
