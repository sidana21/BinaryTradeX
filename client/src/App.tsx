import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import LandingPage from "@/pages/landing";
import TradingPage from "@/pages/trading";
import DepositPage from "@/pages/deposit";
import TransactionsPage from "@/pages/transactions";
import ProfilePage from "@/pages/profile";
import AdminPage from "@/pages/admin";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/trading" component={TradingPage} />
      <Route path="/deposit" component={DepositPage} />
      <Route path="/transactions" component={TransactionsPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/admin" component={AdminPage} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
