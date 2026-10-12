import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AdminAppearanceContext } from "@/contexts/AdminAppearanceContext";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";

afterEach(cleanup);

describe("Management appearance across portals", () => {
  it("carries the admin scope into a dialog outside the tab DOM", () => {
    render(<AdminAppearanceContext.Provider value={true}><Dialog open><DialogContent>
      <DialogTitle>Team toevoegen</DialogTitle><DialogDescription>Deelnemer</DialogDescription>
      <Label htmlFor="team-name">Teamnaam</Label><input id="team-name" />
    </DialogContent></Dialog></AdminAppearanceContext.Provider>);
    expect(screen.getByRole("dialog")).toHaveClass("admin-ui", "admin-dialog");
    expect(screen.getByRole("heading")).toHaveClass("dialog-heading");
    expect(screen.getByText("Teamnaam")).toHaveAttribute("data-ui", "form-label");
  });

  it("carries the same scope into confirmation dialogs", () => {
    render(<AdminAppearanceContext.Provider value={true}><AlertDialog open><AlertDialogContent>
      <AlertDialogTitle>Indeling overschrijven?</AlertDialogTitle><AlertDialogDescription>Bevestig je keuze.</AlertDialogDescription>
    </AlertDialogContent></AlertDialog></AdminAppearanceContext.Provider>);
    expect(screen.getByRole("alertdialog")).toHaveClass("admin-ui", "admin-dialog");
  });

  it("does not apply admin styling to public dialogs", () => {
    render(<Dialog open><DialogContent><DialogTitle>Wedstrijd</DialogTitle><DialogDescription>Publieke wedstrijdgegevens</DialogDescription></DialogContent></Dialog>);
    expect(screen.getByRole("dialog")).not.toHaveClass("admin-ui");
  });
});