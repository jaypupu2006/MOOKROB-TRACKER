# Add a nearby test shop so reporting can be used

Goal: create one extra หมูกรอบ shop close enough to your real location (well under 100 m) so the report flow unlocks.

## How your location is obtained

Since exact coordinates weren't provided, the implementation starts by reading your live GPS from the open preview tab (the browser will show a location permission prompt — please allow it). The new shop is then placed about 30 m away from that point, so you are always inside the 100 m reporting radius.

If the prompt is denied or times out, the step stops and you'll be asked for coordinates instead — no shop is created with a wrong position.

## What gets added

One new restaurant row, styled exactly like the existing 30 seeded shops:

- Realistic Thai name and area matching your location's district
- Address, opening hours (e.g. 08:00–17:00), price range, rating
- Coordinates set from your GPS reading (+~30 m offset), with the map geography value derived from them
- Initial status left as "ยังไม่มีข้อมูล" (unknown) so your own report becomes the first data point
- Reuses one of the existing shop images

## Technical notes

- Data-only change through the database insert tool: one row in `restaurants`; the existing `on_restaurant_inserted` trigger creates the matching `restaurant_status` row, and `geog` is set from latitude/longitude.
- No schema migration, no RLS change, no UI or business-logic change.
- The shop appears automatically on Home and Map because `nearby_restaurants` sorts by distance from your position — it should show at the top of the list.

## Verification

- Confirm the row exists with the expected coordinates and an `unknown` status row.
- Confirm the shop appears in the nearby list for your coordinates and that the distance shown is under 100 m, so "ตรวจสอบตำแหน่ง" unlocks the report buttons.
