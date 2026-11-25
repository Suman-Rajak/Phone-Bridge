# Device test matrix

## T07 · Phone-to-laptop pairing

Run this on a physical phone and laptop with the web app and signaling Worker reachable over HTTPS. [HTTPS setup](../ship/dev-https.md#enable-pairing-from-the-https-page)

1. Put both devices on the same Wi-Fi network for the first row. For the second row, turn on the phone’s hotspot and connect the laptop to it.
2. On the laptop, open the HTTPS web app’s home page and wait for the QR code. On the phone, scan it with the camera and open the link.
3. Check that both pages show **Connected**. Compare the four-digit verification codes and note the time from opening the link to Connected.
4. Open **Advanced** from the Connected status on both devices. Confirm that `control`, `bulk`, and `rt` each show `open`. Record the connection type and RTT when available.
5. Close the phone tab and reload the laptop page to get a fresh QR for the next row.

| Network                           | Phone OS and browser | Laptop OS and browser | Time    | Codes match | Three channels open on both | Connection type and RTT | Result  |
| --------------------------------- | -------------------- | --------------------- | ------- | ----------- | --------------------------- | ----------------------- | ------- |
| Same Wi-Fi                        | Pending              | Pending               | Pending | Pending     | Pending                     | Pending                 | Pending |
| Laptop connected to phone hotspot | Pending              | Pending               | Pending | Pending     | Pending                     | Pending                 | Pending |

For a failure, record the last status or error text and the browser versions. Use **Copy diagnostics** if Advanced is available. Share observations without including the pairing URL, QR code, or network identifiers.
