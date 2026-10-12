export type InvitationLink = { url: string; shareText: string; enabled: boolean; guestVersion: number };
export type GuestInvitation = {
  invitationContext: string;
  wedding: { brideName: string; groomName: string; title: string | null; description: string | null; weddingDate: string; location: string; timezone: string; cover: null };
  guest: { name: string; maxPartySize: number; version: number; rsvp: { status: "pending" | "attending" | "not_attending"; partySize: number; respondedAt: string | null } };
  events: { id: string; name: string; type: string; startsAt: string; endsAt: string | null; venueName: string | null; address: string | null; description: string | null; dressCode: string | null; cover: null }[];
  capabilities: { canRespond: boolean; canAttend: boolean; canViewGallery: boolean; canUploadPhotos: boolean; reasons: string[] };
  livestream: { embedUrl: string } | null;
};
