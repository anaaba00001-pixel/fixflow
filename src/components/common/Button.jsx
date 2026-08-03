import { forwardRef } from "react";

const VARIANT_CLASSES = {
  primary: "primary",
  secondary: "secondary",
  text: "text-button",
  icon: "icon-button",
};

const Button = forwardRef(function Button(
  {
    children,
    type = "button",
    variant = "primary",
    fullWidth = false,
    loading = false,
    loadingText = "جاري التنفيذ…",
    disabled = false,
    className = "",
    leftIcon = null,
    rightIcon = null,
    onClick,
    ...props
  },
  ref
) {
  const variantClass =
    VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary;

  const buttonClassName = [
    variantClass,
    fullWidth ? "wide" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  function handleClick(event) {
    if (loading || disabled) {
      event.preventDefault();
      return;
    }

    onClick?.(event);
  }

  return (
    <button
      ref={ref}
      type={type}
      className={buttonClassName}
      disabled={disabled || loading}
      aria-busy={loading}
      onClick={handleClick}
      {...props}
    >
      {loading ? (
        <span>{loadingText}</span>
      ) : (
        <>
          {rightIcon ? (
            <span aria-hidden="true">{rightIcon}</span>
          ) : null}

          <span>{children}</span>

          {leftIcon ? (
            <span aria-hidden="true">{leftIcon}</span>
          ) : null}
        </>
      )}
    </button>
  );
});

export default Button;
