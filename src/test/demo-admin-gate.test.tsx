import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DemoAdminGate } from "@/components/demo-admin-gate";

afterEach(cleanup);

describe("Vetting demo access", () => {
  it("withholds the dashboard until the demo admin button is used", () => {
    render(<DemoAdminGate><div data-testid="dashboard" /></DemoAdminGate>);
    expect(screen.queryByTestId("dashboard")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Enter as admin/ }));
    expect(screen.getByTestId("dashboard")).toBeInTheDocument();
  });

  it("locks the dashboard again after exiting admin", () => {
    render(<DemoAdminGate><div data-testid="dashboard" /></DemoAdminGate>);
    fireEvent.click(screen.getByRole("button", { name: /Enter as admin/ }));
    fireEvent.click(screen.getByRole("button", { name: /Exit admin/ }));
    expect(screen.queryByTestId("dashboard")).toBeNull();
  });
});