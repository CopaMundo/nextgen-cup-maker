---
name: Dialog discard-on-close pattern
description: All dialogs must use draft state — closing without saving discards changes and restores original values
type: preference
---
Alle popup dialogen gebruiken lokale draft-state. Wijzigingen worden pas doorgevoerd bij expliciet klikken op "Opslaan". Sluiten via het kruisje of buiten de dialog klikken verwijdert alle wijzigingen en herstelt de originele waarden. Nooit auto-save bij onChange in dialogen.