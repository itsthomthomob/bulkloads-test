# EDI Parser Decisions
My personal goal for this test was to make the parser very user-friendly, leveraging more UI/UX decisions rather than pure engineering decisions.

## Color Scheme
The color scheme is pretty basic, it's just the two primary colors BulkLoads has on their website (the bright green and bright orange) with a default dark-mode background, a dark blue shade. 

## Design Choices
The two themes I went with were Swiss Minimalist and Minimalist Monochrome, they're both very similar styles, with swiss minimalism being very mathematical letting the content speak for itself with bold choices. Minimalist Monochrome is similar, but less brutal in a sense that it's more refined and has a "confident" style behind it.

Another design choice I made is to go off of the "rule of 4s" or have spacing for elements be 4, 8, 12, 16. Anything less then 4 pixels apart is too cramped and anything more than 16 is too far. This helps keep the website consistent in spacing.

## Timebox Recording

I started at 3:05 PM, paused development at 4:08 PM because I was at Travellers House on national and they have pretty bad connection. Decided to go home and resume there. I resumed at 4:30 PM. 

## Interactive Map
When I read through the EDI files (manaully) I noticed the location-based variables I thought would be worth showing on a map:
- The Receiver company addreess
- The Receiving company address
- The terminal office
- Pickups 

The map would help the user visually see the shipment direction. However, pasting in an EDI file and getting just a map with details isn't enough. I thought the user should be able to click on each important location on the map and get relevant information about the shipment. 

### The Inspector

The map shows a visual layout of the EDI information, the inspector allows the user to dig more into the file. 

