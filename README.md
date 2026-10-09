# Cancelling

Booking.com hides your free-cancellation deadlines behind tooltips. This extension puts them next to the price.

In your Booking.com reservation list, every booking gets a small label next to its price:

| Colour | Meaning |
| ------ | ------- |
| Green  | Free cancellation still possible, with the last day and the days left |
| Orange | Less than 3 days left |
| Red    | Deadline has passed, or the booking is non-refundable |
| Grey   | Deadline could not be found |

A button in the bottom-right corner opens a list of all bookings sorted by deadline. The labels are included when you print the page (Ctrl+P).

## How it works

The extension only reads, it never changes anything.

1. It looks for the "Free cancellation" / "Kostenlose Stornierung" note on each booking card.
2. It briefly simulates hovering over that note and reads the tooltip, the same way you would with the mouse.
3. If that fails, it loads the booking's detail page in the background (using your existing login) and searches it for the deadline. Links to cancel, modify or pay are never opened.

Results are cached locally for 6 hours. "Neu laden" in the panel clears the cache. No data leaves your browser.

Booking phrases deadlines as "before 16 October", so the extension shows the actual last day (15 October). Hover over a label to see Booking's original wording.

Supported languages: German and English.

## Installation

**Chrome, Edge, Brave**

1. Download or clone this repository.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on Developer mode.
4. Click "Load unpacked" and select the folder.

**Firefox (121 or newer)**

1. Open `about:debugging#/runtime/this-firefox`.
2. Click "Load Temporary Add-on…" and select `manifest.json`.

Temporary add-ons are removed when Firefox restarts.

## Troubleshooting

Booking.com changes its pages from time to time. If no labels appear, open the developer console (F12) and look for messages starting with `[Cancelling]`. They show how many bookings were found and where each deadline came from. The search patterns live at the top of `content.js`.

## Disclaimer

Not affiliated with Booking.com. The deadline shown is taken from Booking's own text and may be wrong. The terms in your booking confirmation always apply, and deadlines usually refer to the property's local time.
