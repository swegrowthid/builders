"use client";

import { useState, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";

type Props = ComponentProps<"button"> & {
  /** What the button says while its form is in flight. Omit to keep the label. */
  pendingLabel?: string;
};

/**
 * A submit button that admits the form is working.
 *
 * Server actions give no feedback between the click and the re-render, so a
 * button that stays inert reads as a page that ignored you. This one disables
 * itself and, where a label is given, says what it is doing — which also stops
 * the double-submits an unresponsive button invites.
 *
 * In a form with several submit buttons, all of them go quiet together; the
 * aria-busy styling marks the whole form as in flight.
 */
export function SubmitButton({ pendingLabel, children, disabled, ...rest }: Props) {
  const { pending } = useFormStatus();

  return (
    <button {...rest} type="submit" disabled={disabled || pending} aria-busy={pending || undefined}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/**
 * A submit button that asks once: the first press turns it into its
 * confirmation, the second sends. Leaving it disarms it. Without JavaScript
 * it submits on the first press, like any button.
 */
export function ConfirmSubmitButton({ confirmLabel, children, onClick, onBlur, ...rest }: Props & { confirmLabel: string }) {
  const [armed, setArmed] = useState(false);

  return (
    <SubmitButton
      {...rest}
      onClick={(event) => {
        if (!armed) {
          event.preventDefault();
          setArmed(true);
        }
        onClick?.(event);
      }}
      onBlur={(event) => {
        setArmed(false);
        onBlur?.(event);
      }}
    >
      {armed ? confirmLabel : children}
    </SubmitButton>
  );
}
