import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Section,
  Row,
  Column,
} from '@react-email/components';

interface OrganizationInviteEmailProps {
  organizationName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
  rejectUrl: string;
}

export default function OrganizationInviteEmail({
  organizationName,
  inviterName,
  role,
  acceptUrl,
  rejectUrl,
}: OrganizationInviteEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ background: '#f4f4f4', padding: '40px 0' }}>
        <Container
          style={{
            maxWidth: '520px',
            margin: '0 auto',
            background: '#ffffff',
            padding: '24px',
            border: '1px solid #e0e0e0',
          }}
        >
          <Section
            style={{
              border: '3px double #4b2a85',
              padding: '36px 22px',
              textAlign: 'center' as const,
            }}
          >
            <Heading
              style={{
                color: '#1a1a1a',
                fontSize: '26px',
                fontWeight: 'normal',
                textTransform: 'uppercase' as const,
                letterSpacing: '3px',
                margin: '0 0 14px',
              }}
            >
              Organization Invitation
            </Heading>

            <Text style={{ color: '#555', fontSize: '15px', lineHeight: '1.7' }}>
              {inviterName} invited you to join
            </Text>

            <Text
              style={{
                color: '#4b2a85',
                fontSize: '22px',
                fontWeight: 'bold',
                margin: '8px 0 18px',
              }}
            >
              {organizationName}
            </Text>

            <Text style={{ color: '#444', fontSize: '14px', margin: '0 0 28px' }}>
              Role: <strong>{role}</strong>
            </Text>

            <Row style={{ width: '100%', maxWidth: '360px', margin: '0 auto 32px' }}>
              <Column style={{ paddingRight: '10px' }}>
                <Button
                  href={acceptUrl}
                  style={{
                    background: '#4b2a85',
                    color: '#fff',
                    padding: '12px 0',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    width: '100%',
                    textAlign: 'center' as const,
                    display: 'block',
                    textDecoration: 'none',
                  }}
                >
                  ACCEPT
                </Button>
              </Column>
              <Column style={{ paddingLeft: '10px' }}>
                <Button
                  href={rejectUrl}
                  style={{
                    background: 'transparent',
                    color: '#4b2a85',
                    padding: '10px 0',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    border: '2px solid #4b2a85',
                    width: '100%',
                    textAlign: 'center' as const,
                    display: 'block',
                    textDecoration: 'none',
                  }}
                >
                  REJECT
                </Button>
              </Column>
            </Row>

            <Text style={{ color: '#999', fontSize: '11px', lineHeight: '1.5' }}>
              This is an automated organization invitation. Please sign in with
              the invited email before accepting.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
