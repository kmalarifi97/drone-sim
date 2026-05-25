import { useStore } from './state/store';
import AssemblyView from './assembly/AssemblyView';
import FlightView from './flight/FlightView';

export default function App() {
  const view = useStore((s) => s.view);
  return view === 'flight' ? <FlightView /> : <AssemblyView />;
}
