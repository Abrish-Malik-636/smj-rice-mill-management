// Fixed 4-digit PIN input: four separate boxes, one digit each.
import React, { useRef } from "react";

const PIN_LENGTH = 4;

export default function Pin4Input({ value = "", onChange, onComplete, error, disabled, className = "", inputClassName = "" }) {
  const pin = String(value).replace(/\D/g, "").slice(0, PIN_LENGTH);
  const refs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  const setPinAt = (index, digit) => {
    const digits = pin.split("");
    digits[index] = digit;
    const next = digits.join("").slice(0, PIN_LENGTH);
    onChange(next);
    if (next.length === PIN_LENGTH && onComplete) onComplete(next);
  };

  const focusAt = (index) => {
    refs[index]?.current?.focus();
  };


  const handleChange = (index, e) => {
    const v = e.target.value.replace(/\D/g, "").slice(-1);
    if (v) {
      setPinAt(index, v);
      if (index < PIN_LENGTH - 1) focusAt(index + 1);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (pin[index]) {
        setPinAt(index, "");
        e.preventDefault();
      } else if (index > 0) {
        setPinAt(index - 1, "");
        focusAt(index - 1);
        e.preventDefault();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (pin.length === PIN_LENGTH && onComplete) onComplete(pin);
    } else if (e.key === "ArrowLeft" && index > 0) focusAt(index - 1);
    else if (e.key === "ArrowRight" && index < PIN_LENGTH - 1) focusAt(index + 1);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, PIN_LENGTH);
    if (pasted) {
      onChange(pasted);
      if (pasted.length === PIN_LENGTH) focusAt(PIN_LENGTH - 1);
      else focusAt(pasted.length);
    }
  };

  const baseInputClass = `w-12 h-12 text-center text-lg font-semibold border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${error ? "border-red-500 bg-red-50" : "border-gray-300"} ${inputClassName}`;

  return (
    <div className={`flex gap-2 justify-center ${className}`}>
      {[0, 1, 2, 3].map((i) => (
        <input
          key={i}
          ref={refs[i]}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={pin[i] ?? ""}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className={baseInputClass}
          autoComplete="one-time-code"
          aria-label={`PIN digit ${i + 1}`}
        />
      ))}
    </div>
  );
}
