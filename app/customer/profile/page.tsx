import { User, Mail, Phone, MapPin, Calendar, Pencil } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader, Card } from "@/components/customer/ui";
import { CUSTOMER } from "@/components/customer/data";

// OWNER: Devanshi | MODULE: Customer Profile (hardcoded)
export default function CustomerProfilePage() {
  const fields = [
    { icon: User, label: "Full name", value: CUSTOMER.name },
    { icon: Mail, label: "Email", value: CUSTOMER.email },
    { icon: Phone, label: "Phone", value: CUSTOMER.phone },
    { icon: Calendar, label: "Date of birth", value: CUSTOMER.dob },
    { icon: User, label: "Gender", value: CUSTOMER.gender },
    { icon: MapPin, label: "Address", value: CUSTOMER.address },
  ];

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Your personal details and preferences."
        action={
          <button className={cn(buttonVariants({ variant: "outline" }))}>
            <Pencil className="size-4" /> Edit Profile
          </button>
        }
      />

      {/* Identity card */}
      <Card className="mb-6 flex flex-col items-center gap-4 p-7 text-center sm:flex-row sm:text-left">
        <img
          src={CUSTOMER.avatar}
          alt={CUSTOMER.name}
          className="size-24 rounded-full object-cover ring-2 ring-border"
        />
        <div>
          <h2 className="font-heading text-2xl font-bold">{CUSTOMER.name}</h2>
          <p className="text-sm text-muted-foreground">{CUSTOMER.email}</p>
          <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
            Member since {CUSTOMER.memberSince}
          </p>
        </div>
      </Card>

      {/* Details */}
      <Card className="p-7">
        <h3 className="mb-6 font-heading text-lg font-semibold">Personal information</h3>
        <div className="grid gap-6 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.label} className="flex items-start gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center bg-muted text-primary">
                <f.icon className="size-4.5" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{f.label}</p>
                <p className="mt-0.5 text-sm font-medium">{f.value}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
