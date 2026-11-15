# Bihar RTPS Form Helper

A Firefox extension that saves the details you enter on Bihar RTPS (Right to Public Services) service forms (Residence, Caste, Income) and fills them back in with one click. It works only on `serviceonline.bihar.gov.in`.

## How to use

1. Open the RTPS application form and fill in your details.
2. Click the extension icon, type a profile name, and click **Save**.
3. On a new form, click the icon, select the profile, and click **Fill**.
4. Review every field before you submit. The extension is a helper, not a replacement for checking your own application.

## ⚠️ Important: save your profile *before* choosing the Panchayat / Nagar Nigam

After you pick **Type of Local Body** (Gram Panchayat / Nagar Nigam / Nagar Parishad / Nagar Panchayat), the portal loads a second dropdown with the specific name (for example, your Gram Panchayat).

- **Save your profile before you choose a value in that dropdown.**
- This dropdown is **not auto-filled**. The extension selects the Local Body Type for you, and you then choose the Panchayat / Nagar Nigam / Nagar Parishad / Nagar Panchayat name yourself after every Fill.

## Features

- Multiple named profiles, stored in your browser
- Export and import profiles as a `.json` file
- Fills personal, address and other form fields on supported RTPS forms
- Currently supports: Residence, Caste and Income certificate forms

## Roadmap

- [ ] OBC certificate form support
- [ ] NCL (Non-Creamy Layer) certificate form support

## Privacy

- All profiles are stored **locally** in your browser (`storage.local`).
- Nothing is sent to any server. The extension makes no network requests.
- Exported `.json` files contain personal details. Keep them private and **never commit them to a public repository**.

## Permissions

| Permission | Why it is needed |
|---|---|
| `storage` | Save your profiles in the browser |
| `activeTab`, `scripting` | Read and fill the form on the tab you are using |
| `https://serviceonline.bihar.gov.in/*` | Run only on the RTPS portal |

If the helper does not load automatically, open `about:addons`, choose the extension, go to **Permissions**, and allow access to `serviceonline.bihar.gov.in`.

## Install (temporary, for testing)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and select `manifest.json`.

## Disclaimer

This is an unofficial tool and is not affiliated with or endorsed by the Government of Bihar. The portal's layout can change and break auto-fill, so always verify the filled data before submitting.

## License

Code: [MIT](LICENSE).

## Credits

Icon: clipboard-document-check from [Heroicons](https://github.com/tailwindlabs/heroicons) by Tailwind Labs, MIT license. Recolored. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
