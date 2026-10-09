# Cancelling.com

Booking.com hides your free-cancellation deadlines behind tooltips. This extension puts them right below the price.

In your Booking.com reservation list, every booking gets a small label under its price:

| Look | Meaning |
| ---- | ------- |
| Grey | Free cancellation still possible, with the last day and the days left |
| Yellow | Less than 3 days left (number of days and colour are configurable) |
| Red | Deadline has passed, or the booking is non-refundable |
| Red **!** | The booking's nights overlap with another booking |

## ⚠️ Overlapping bookings

If you book several places for the same night, you end up paying for all of them unless you cancel the extra ones in time. Cancelling marks every booking whose nights overlap with another one with a red **!** and names the other booking, so you can decide which one to keep and cancel the rest before their deadline.

Overlaps are checked per night: 1–4 and 3–5 overlap, 1–4 and 4–6 (check-out and check-in on the same day) do not. Stays across New Year (28 Dec – 2 Jan) are handled too.

## Panel and copy list

The blue **Cancelling · X bookings** button in the bottom-right corner opens a list of all bookings sorted by deadline. The panel also has a **DE / EN** language switch, a **?** that opens the help page, **Reload** to look up all deadlines again, and two copy buttons. **Copy list** puts all bookings on your clipboard as plain text, ready to paste into a chat or note:

```
My bookings – copied on Fri, 09/10/2026, 16:39

1. Seaside Loft Alfama
   16 Oct–18 Oct · Lisbon
   Room: Studio with River View
   Free cancellation until Sat, 10/10/2026 (last day!)
   Property: https://www.booking.com/hotel/pt/seaside-loft-alfama.html
   Booking (private – do not share): https://secure.booking.com/...

2. Canal House Jordaan
   23 Oct–26 Oct · Amsterdam
   Free cancellation until Wed, 21/10/2026 (12 days left)
   Property: https://www.booking.com/hotel/nl/canal-house-jordaan.html
   Booking (private – do not share): https://secure.booking.com/...

3. Terrazza Trastevere
   2 Nov–5 Nov · Rome
   Free cancellation until Fri, 30/10/2026 (21 days left)
   ! Overlaps with: Casa Monti
   Property: https://www.booking.com/hotel/it/terrazza-trastevere.html
   Booking (private – do not share): https://secure.booking.com/...

4. Casa Monti
   4 Nov–6 Nov · Rome
   Free cancellation expired Mon, 05/10/2026
   ! Overlaps with: Terrazza Trastevere
   Property: https://www.booking.com/hotel/it/casa-monti.html
   Booking (private – do not share): https://secure.booking.com/...
```

**Copy for sharing** is meant for friends or travel companions: exactly the same list, including deadlines and overlap warnings, but without your private booking links. Those contain a personal access key (`auth_key`) and should not be shared. Tracking parameters (`label`, `sid`, `gclid`, `aid` …) are removed from all copied links.

```
Our places to stay – as of Fri, 09/10/2026, 16:39

1. Seaside Loft Alfama
   16 Oct–18 Oct · Lisbon
   Room: Studio with River View
   Free cancellation until Sat, 10/10/2026 (last day!)
   Property: https://www.booking.com/hotel/pt/seaside-loft-alfama.html
```

The booked room and the public property link are read from the booking's detail page in the background and cached for 30 days. If the room can't be found there (Booking sometimes builds that part only in the browser), it is picked up the next time you open the booking's detail page yourself. Until then, that line is simply left out. If it can't be found, a Booking.com search for the property's name and town is used instead (`Property (search): …`).

While data is still loading in the background, the panel button shows a spinner and "loading 12/29", and the panel shows how many deadlines, rooms and links are ready. Lists copied before that include a note that they are incomplete.

"X days left" refers to the time in the first line. The labels are also included when you print the page (Ctrl+P / ⌘+P); the panel is hidden when printing.

## Settings and help

Open the settings via the Cancelling icon in the browser toolbar (behind the puzzle icon if it isn't pinned) or via the **?** in the panel, which opens the built-in help page in German or English. It explains the labels, the copy list, overlaps and troubleshooting, and contains all settings:

- **Language**: automatic (matches the Booking.com page), German or English. Also switchable directly in the panel.
- **Highlight**: how many days before the deadline a booking turns yellow (default 3), and the colour.
- **Close promo pop-ups**: on booking confirmation pages, automatically closes the "Don't forget to use your rewards" pop-up (airport transfer, car rental, activities…) by clicking its close button. Only that pop-up is touched; all other dialogs, such as cancellation confirmations, are left alone. On by default.

The extension only runs on the reservation list (`secure.booking.com/mytrips…`). The pop-up closer only runs on booking confirmation pages.

## How it works

The extension only reads, it never changes a booking.

1. It looks for the "Free cancellation" / "Kostenlose Stornierung" note on each booking card.
2. It briefly simulates hovering over that note and reads the tooltip, the same way you would with the mouse. If Booking redraws the card in that moment, it retries automatically.
3. If that fails, it loads the booking's detail page in the background (using your existing login) and searches it for the deadline. Links to cancel, modify or pay are never opened.

Results are cached locally for 6 hours; **Reload** in the panel clears the cache. No data leaves your browser.

### Why the deadline may be one day early

In the reservation list, Booking only gives a day, e.g. "before Sat, 31 October", so the extension shows the day before (30 October). Often the deadline actually runs until a specific time on the 31st (e.g. 18:00, as shown on the booking's detail page). The extension deliberately errs on the safe side: it may show the deadline one day early, but never too late. Hover over a label to see Booking's original wording.

Supported languages: German and English.

## Installation

**Chrome, Edge, Brave**

1. Clone this repository: `git clone https://github.com/<your-name>/cancelling.git`
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on Developer mode.
4. Click "Load unpacked" and select the folder.

Keep the folder in a permanent place; the browser loads the extension from it on every start.

**Firefox (121 or newer)**

1. Open `about:debugging#/runtime/this-firefox`.
2. Click "Load Temporary Add-on…" and select `manifest.json`.

Temporary add-ons are removed when Firefox restarts.

**Updating**

Run `git pull` in the folder, then click the reload icon next to Cancelling in `chrome://extensions` and reload the Booking.com page.

## Troubleshooting

- **"Looking for deadline…" stays, or "Deadline not found"**: click **Reload** in the panel.
- **Nothing appears**: reload the page. If that doesn't help, open the developer console (F12) and look for messages starting with `[Cancelling]`. They show how many bookings were found and where each deadline came from.
- Booking.com changes its pages from time to time. The search patterns live at the top of `content.js`.

## Files

| File | Purpose |
| ---- | ------- |
| `content.js`, `styles.css` | Labels and panel on the reservation list |
| `room.js` | Reads the booked room ("Your room information") |
| `quiet.js` | On confirmation pages: remembers the booked room, closes the promo pop-up |
| `help.html`, `popup.html`, `settings.js` | Help page, toolbar menu and shared settings |
| `background.js` | Loads detail pages, opens the help page |
| `icons/` | Extension icons |

## Disclaimer

Not affiliated with Booking.com. The deadline shown is taken from Booking's own text and may be wrong. The terms in your booking confirmation always apply, and deadlines usually refer to the property's local time.
