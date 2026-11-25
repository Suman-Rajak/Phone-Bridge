# Open the development app over HTTPS on a phone

Camera, motion, and clipboard APIs require a secure context. A laptop browser can use HTTP on localhost. A phone opening the laptop’s LAN address needs HTTPS. For either setup below, start from the repository root after running `pnpm install`. [MDN secure contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts)

## Option 1 — Temporary HTTPS tunnel

1. Install [cloudflared](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/). A Quick Tunnel needs no Cloudflare account. [Quick Tunnel documentation](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
2. In one terminal, start Vite.

   ```sh
   pnpm dev:web --host 127.0.0.1 --port 5173 --strictPort
   ```

3. In a second terminal, start the tunnel and copy the hostname it prints, such as example-name.trycloudflare.com.

   ```sh
   cloudflared tunnel --url http://127.0.0.1:5173
   ```

4. Stop Vite in the first terminal, allow that exact hostname, and start Vite again. Replace example-name.trycloudflare.com with the actual hostname, without the scheme or any path. Leave the tunnel running. [Vite allowed hosts](https://vite.dev/config/server-options#server-allowedhosts)

   PowerShell

   ```powershell
   $env:__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS = 'example-name.trycloudflare.com'
   pnpm dev:web --host 127.0.0.1 --port 5173 --strictPort
   ```

   Bash or Zsh

   ```sh
   __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=example-name.trycloudflare.com pnpm dev:web --host 127.0.0.1 --port 5173 --strictPort
   ```

5. Open https://example-name.trycloudflare.com/diagnostics on the phone. The header should read **Secure page**. Replace the hostname in both places each time the tunnel assigns a new one.

Anyone with an unprotected Quick Tunnel URL can reach the running dev server. Stop cloudflared when you finish. [Cloudflare Quick Tunnel access controls](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/#restrict-access-by-email)

## Option 2 — Locally trusted certificate

1. Put the phone and laptop on the same trusted Wi-Fi network. Find the laptop’s LAN IPv4 address under the Wi-Fi adapter, such as 192.168.1.20. If using Windows, run ipconfig to see the adapter addresses.
2. Install [mkcert](https://github.com/FiloSottile/mkcert#installation). Run the commands below with your own LAN address. The .certs directory is ignored by Git.

   PowerShell

   ```powershell
   $phonebridgeLanIp = '192.168.1.20'
   New-Item -ItemType Directory -Force .certs | Out-Null
   mkcert -install
   mkcert -key-file .certs/lan-key.pem -cert-file .certs/lan.pem $phonebridgeLanIp localhost 127.0.0.1
   $env:PHONEBRIDGE_DEV_TLS_KEY = (Resolve-Path .certs/lan-key.pem).Path
   $env:PHONEBRIDGE_DEV_TLS_CERT = (Resolve-Path .certs/lan.pem).Path
   pnpm dev:web --host $phonebridgeLanIp --port 5173 --strictPort
   ```

   Bash or Zsh

   ```sh
   phonebridge_lan_ip=192.168.1.20
   mkdir -p .certs
   mkcert -install
   mkcert -key-file .certs/lan-key.pem -cert-file .certs/lan.pem "$phonebridge_lan_ip" localhost 127.0.0.1
   PHONEBRIDGE_DEV_TLS_KEY="$PWD/.certs/lan-key.pem" PHONEBRIDGE_DEV_TLS_CERT="$PWD/.certs/lan.pem" \
     pnpm dev:web --host "$phonebridge_lan_ip" --port 5173 --strictPort
   ```

3. Run mkcert -CAROOT to find the local certificate authority directory. Transfer only rootCA.pem from that directory to your own test phone. Keep the certificate authority private key and the server private key on the laptop. [mkcert mobile setup](https://github.com/FiloSottile/mkcert#mobile-devices)
4. On iOS, open the certificate and install the downloaded profile in Settings. Then go to **Settings → General → About → Certificate Trust Settings** and enable full trust for that root. On Android, use **Settings → Security & privacy → More security settings → Encryption & credentials → Install a certificate → CA certificate** or the equivalent on your device. If the Android file picker needs a .crt extension, rename the copy of rootCA.pem before installing it. [Apple certificate trust](https://support.apple.com/en-us/102390) · [Android certificate installation](https://support.google.com/pixelphone/answer/2844832)
5. On the phone, visit https://192.168.1.20:5173/diagnostics with your own LAN address. Confirm the browser opens the page without a certificate warning and the header reads **Secure page**. Remove the test CA from the phone when you are finished.

If the LAN page cannot connect, check the laptop’s private-network firewall and that the Wi-Fi allows devices to reach each other. If the address changed, regenerate the certificate for the new address. If **Secure page** appears and a capability is **Unavailable**, compare the browser with the [expected capability matrix](../understand/browser-capabilities.md).
