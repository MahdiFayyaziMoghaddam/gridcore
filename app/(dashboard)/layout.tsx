import { Navbar, NavbarLogo, NavbarSection } from '@/components/layout/Navbar'
import { UserMenu } from '@/components/layout/UserMenu'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col">
      <Navbar>
        <NavbarLogo />
        <NavbarSection className="ml-auto">
          <UserMenu />
        </NavbarSection>
      </Navbar>
      {children}
    </div>
  )
}