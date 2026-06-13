# Commons Sewer Map — Shared Version

This is the shared-storage version of the Commons on the Alameda sewer/cleanout map.
Markers added by anyone are saved centrally (via Netlify Blobs) so everyone sees the same map.

## Folder structure

```
/
├── netlify.toml
├── package.json
├── public/
│   ├── index.html
│   └── app.js
└── netlify/
    └── functions/
        └── markers.js
```

## Deploying via GitHub + Netlify

1. Create a new repository on GitHub (e.g. `commons-sewer-map`).
2. Upload all the files/folders above, preserving the folder structure
   (drag-and-drop on GitHub's "Add file → Upload files" page supports
   uploading whole folders in most browsers).
3. On Netlify, click **Add new site → Import an existing project**, choose
   GitHub, and select this repository.
4. Build settings should be auto-detected from `netlify.toml`
   (publish directory: `public`, functions directory: `netlify/functions`).
   Leave the build command blank.
5. Click **Deploy**. Netlify will install `@netlify/blobs` and deploy the
   function automatically.
6. Once deployed, visit the site URL — the map should load and any markers
   added will be saved to the shared store automatically.

## Updating later

Any future file changes just need to be pushed/uploaded to the same GitHub
repo — Netlify will redeploy automatically.
