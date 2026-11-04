// Per-user counter of metadata changes (tags, favourites, wallpapers).
// A full rescan reads it before and after walking the disk: if it moved, an edit
// landed while the walk was running and may be missing from it, so the walk is repeated.
const versions = new Map<string, number>()

export function bumpMetaVersion(username: string) {
    versions.set(username, (versions.get(username) ?? 0) + 1)
}

export function getMetaVersion(username: string): number {
    return versions.get(username) ?? 0
}

/** Test helper */
export function resetMetaVersionsForTests() {
    versions.clear()
}
