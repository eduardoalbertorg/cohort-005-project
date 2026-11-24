import { useEffect, useState } from "react";
import { Bell, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Link, useSearchParams } from "react-router";

// Throwaway prototype: compare a popover, drawer, and inbox in the app shell.
const variants = ["Popover", "Drawer", "Inbox"];
const samples = [
  [
    "Instructor",
    "New lesson question",
    "A Student asked a question in Design Foundations.",
    "/instructor/questions",
    "Open Questions",
  ],
  [
    "Student",
    "Your question has a reply",
    "Your Course Instructor replied in Design Foundations.",
    "/dashboard",
    "Open Dashboard",
  ],
  [
    "Platform Admin",
    "Refund Request opened",
    "A buyer requested a refund for Design Foundations.",
    "/admin/refunds",
    "Review request",
  ],
  [
    "Buyer",
    "Refund Request approved",
    "Your Refund is pending confirmation.",
    "/settings",
    "View request",
  ],
  [
    "Buyer",
    "Refund Request declined",
    "A Platform Admin reviewed your request.",
    "/settings",
    "View request",
  ],
  [
    "Buyer",
    "Refund issued",
    "Your full Refund was confirmed as sent.",
    "/settings",
    "View Refund",
  ],
  [
    "Platform Admin",
    "Refund failed",
    "A Refund for Design Foundations needs attention.",
    "/admin/refunds",
    "Investigate Refund",
  ],
  [
    "Team Admin",
    "Seat claimed",
    "Sam claimed a Seat on your Team Licence.",
    "/team",
    "View Team Licence",
  ],
].map(([recipient, title, detail, to, action], id) => ({
  recipient,
  title,
  detail,
  to,
  action,
  id,
}));

export function NotificationPrototype() {
  const [params, setParams] = useSearchParams();
  const variant = Math.max(0, variants.indexOf(params.get("variant") ?? ""));
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState("Buyer");
  const [read, setRead] = useState<number[]>([4]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const feed = samples.filter((item) => item.recipient === recipient);
  const unread = feed.filter((item) => !read.includes(item.id));
  const visible = unreadOnly ? unread : feed;

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  function cycle(direction: number) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set(
          "variant",
          variants[(variant + direction + variants.length) % variants.length]
        );
        return next;
      },
      { replace: true }
    );
  }

  function markRead(ids: number[]) {
    setRead((previous) => [...new Set([...previous, ...ids])]);
  }

  const feedPanel = (
    <>
      <div className="flex items-center justify-between gap-4 border-b p-4">
        <div>
          <h2 className="text-lg font-semibold">Notifications</h2>
          <p className="text-sm text-muted-foreground">
            {unread.length} unread
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close notifications"
        >
          <X size={20} />
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(event) => setUnreadOnly(event.target.checked)}
          />
          Unread only
        </label>
        <button
          type="button"
          className="underline disabled:opacity-40"
          disabled={!unread.length}
          onClick={() => markRead(unread.map((item) => item.id))}
        >
          Mark all as read
        </button>
      </div>
      <ul
        className={variant === 2 ? "grid gap-4 p-4 lg:grid-cols-2" : "divide-y"}
      >
        {visible.map((item) => (
          <li
            key={item.id}
            className={variant === 2 ? "rounded-xl border p-4" : "p-4"}
          >
            <div className="flex items-center gap-2">
              {!read.includes(item.id) && (
                <span
                  className="size-2 rounded-full bg-blue-600"
                  aria-label="Unread"
                />
              )}
              <h3 className="font-medium">{item.title}</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <Link
                className="font-medium underline"
                to={item.to}
                onClick={() => {
                  markRead([item.id]);
                  setOpen(false);
                }}
              >
                {item.action}
              </Link>
              {!read.includes(item.id) && (
                <button
                  type="button"
                  className="text-muted-foreground underline"
                  onClick={() => markRead([item.id])}
                >
                  Mark as read
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {!visible.length && (
        <p className="p-6 text-sm text-muted-foreground">
          You’re all caught up.
        </p>
      )}
    </>
  );

  return (
    <div>
      <div
        className={
          variant === 2 ? "border-b p-3" : "flex justify-end border-b px-5 py-3"
        }
      >
        <button
          type="button"
          aria-label={`Notifications, ${unread.length} unread`}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-muted"
        >
          <Bell size={18} />
          {variant !== 0 && "Notifications"}
          {!!unread.length && (
            <span className="rounded-full bg-blue-600 px-1.5 text-xs text-white">
              {unread.length}
            </span>
          )}
        </button>
      </div>
      {open && variant === 0 && (
        <section
          aria-label="Notification feed"
          className="absolute right-4 z-40 mt-2 max-h-[70vh] w-[min(24rem,calc(100vw-2rem))] overflow-auto rounded-xl border bg-background shadow-xl"
        >
          {feedPanel}
        </section>
      )}
      {open && variant === 1 && (
        <aside
          aria-label="Notification feed"
          className="fixed inset-y-0 right-0 z-40 w-[min(29rem,100vw)] overflow-auto border-l bg-background pb-20 shadow-xl"
        >
          {feedPanel}
        </aside>
      )}
      {open && variant === 2 && (
        <section
          aria-label="Notification inbox"
          className="mx-auto my-6 max-w-5xl rounded-xl border bg-background"
        >
          {feedPanel}
        </section>
      )}
      <div
        className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-sm text-white shadow-xl"
        onKeyDown={(event) => {
          if (event.target instanceof HTMLSelectElement) return;
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            cycle(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}
      >
        <button
          type="button"
          aria-label="Previous variant"
          onClick={() => cycle(-1)}
        >
          <ChevronLeft size={18} />
        </button>
        <span className="whitespace-nowrap">
          Prototype · {variants[variant]}
        </span>
        <button
          type="button"
          aria-label="Next variant"
          onClick={() => cycle(1)}
        >
          <ChevronRight size={18} />
        </button>
        <select
          aria-label="Preview recipient"
          className="rounded bg-neutral-800 p-1"
          value={recipient}
          onChange={(event) => setRecipient(event.target.value)}
        >
          {[...new Set(samples.map((item) => item.recipient))].map((role) => (
            <option key={role}>{role}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
