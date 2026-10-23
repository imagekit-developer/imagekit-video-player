/** Whether `event` is Enter or Space, the keys that activate a button-like element. */
export const isActivationKey = (event: KeyboardEvent): boolean => event.key === 'Enter' || event.key === ' ';
