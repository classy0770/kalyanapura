import Link from "next/link";
import { formatEventTime, type WeddingEvent } from "../schemas";
import styles from "./events.module.css";
export function EventsOverview({ events, count }: { events: WeddingEvent[]; count: number }) {
  return <div className={styles.overview}><p>{count === 0 ? "No events yet. Add your first celebration to start your itinerary." : events.length === 0 ? "Your saved events have already started. Open the itinerary to see them." : "Your next celebrations, in India Standard Time."}</p><div>{events.map(event => <article key={event.id}><h3>{event.name}</h3><p><time dateTime={event.startsAt}>{formatEventTime(event.startsAt)}</time> IST · {event.venueName || "Venue to be decided"}</p><Link href="/dashboard/events">View event details →</Link></article>)}</div><Link href="/dashboard/events">{count === 0 ? "+ Add your first event" : "Open events & itineraries →"}</Link></div>;
}
