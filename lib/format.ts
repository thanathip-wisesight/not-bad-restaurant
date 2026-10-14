export const baht = (n: number) => `฿${n.toLocaleString("en-US")}`;

// Server renders in UTC on Vercel; receipts must show Bangkok time.
export const formatTime = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(d);
