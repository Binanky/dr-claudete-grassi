import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import AdminPanel from "@/pages/AdminPanel";
import BookAppointment from "@/pages/BookAppointment";
import TrackAppointment from "@/pages/TrackAppointment";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/agendar" component={BookAppointment} />
    <Route path="/acompanhar" component={TrackAppointment} />
    <Route path="/agendamento/:token" component={TrackAppointment} />
    <Route path="/painel" component={AdminPanel} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
