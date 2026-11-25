import { useState } from "react";
import { cleanFeedback, MAX_FEEDBACK } from "../models/feedback";
import type { Budget } from "./useBudget";
import { useAsyncAction } from "./useAsyncAction";

/**
 * Manage → Send feedback: the message being written and sending it. The
 * text stays when sending fails, and clears once it is sent.
 */
export function useFeedback(budget: Budget) {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const send = useAsyncAction((text: string) => budget.sendFeedback(cleanFeedback(text)));

  return {
    message,
    max: MAX_FEEDBACK,
    sent,
    pending: send.pending,
    error: send.error,

    edit: (text: string) => {
      setMessage(text);
      setSent(false);
      send.clearError();
    },

    submit: async () => {
      if ((await send.run(message)).ok) {
        setMessage("");
        setSent(true);
      }
    },
  };
}
