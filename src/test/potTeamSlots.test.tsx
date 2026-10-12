import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PotTeamSlots } from "@/components/draw/PotTeamSlots";

afterEach(cleanup);
const teams = [{ id: "a", name: "Ajax" }, { id: "b", name: "Brugge" }, { id: "c", name: "Celtic" }];

describe("Pot team choices", () => {
  it("hides assigned teams from empty slots", async () => {
    render(<PotTeamSlots teams={teams} teamIds={[]} assignedIds={new Set(["a", "b"])} capacity={1} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("combobox"));
    expect(await screen.findByRole("option", { name: "Celtic" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Ajax" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Brugge" })).not.toBeInTheDocument();
  });

  it("retains the current selection and allows an unassigned replacement", async () => {
    const change = vi.fn();
    render(<PotTeamSlots teams={teams} teamIds={["a"]} assignedIds={new Set(["a", "b"])} capacity={1} onChange={change} />);
    fireEvent.click(screen.getByRole("combobox"));
    expect(await screen.findByRole("option", { name: "Ajax" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Brugge" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Celtic" }));
    expect(change).toHaveBeenCalledWith(0, "c");
  });
});