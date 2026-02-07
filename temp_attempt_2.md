# Task History - Attempt 2

## Request - what the user asked for
*“Update the coffee product display so that the default packaging is shown in jars.
When the user selects the 1 kg option, automatically switch the product image to the sealed packet version.
This should work like Amazon’s variant image switching:

Default weight options (250g, 500g, etc.) = show jar images

1 kg option = show vacuum‑sealed packet image
Ensure the transition is smooth, responsive, and does not affect any other sections of the website.”**

---

## Response - what the agent replied with after its work

# Coffee Product Display Update

Updated the "Current Offers" section on the homepage to support interactive packaging image switching based on the selected weight.

## Changes

- **Interactive Weight Selection:** Replaced the static price list in the "Current Offers" section with radio buttons, allowing users to select 100g, 250g, 500g, or 1kg options.
- **Dynamic Image Switching:** Implemented logic to automatically switch the product image based on the selected weight:
    - **Default (250g, 500g, etc.):** Displays the product in a jar/bottle.
    - **1kg Option:** Displays the product in a vacuum-sealed packet.
- **Data Update:** Updated the `currentOffers` data structure to include references for both jar and packet images for each blend (Entry-Level, Mid-Tier, Premium).

## Verification

- Validated that the necessary jar and packet image assets exist in `public/images/offers/`.
- Verified that the project builds successfully with `npm run build`.

