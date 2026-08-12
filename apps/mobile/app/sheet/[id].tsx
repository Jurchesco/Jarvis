import { Redirect } from "expo-router";

/** Plany treningowe wyłączone — przekierowanie na home (freestyle). */
export default function SheetRouteRedirect() {
  return <Redirect href="/" />;
}
