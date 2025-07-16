import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/Card';
import { Layout, Header, Main, Footer } from '@/components/layout/Layout';

export default function Home() {
  return (
    <>
      <Header sticky>
        <div className="flex items-center">
          <Image
            src="/jetmail-logo.svg"
            alt="Email Marketing Platform"
            width={120}
            height={30}
            priority
          />
        </div>
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm">
            Dashboard
          </Button>
          <Button variant="ghost" size="sm">
            Campaigns
          </Button>
          <Button variant="ghost" size="sm">
            Subscribers
          </Button>
          <Button variant="primary" size="sm">
            Sign In
          </Button>
        </div>
      </Header>

      <Main>
        <Layout>
          <div className="mb-12 text-center">
            <h1 className="text-4xl font-bold mb-4 text-secondary-900">Email Marketing Platform</h1>
            <p className="text-xl text-secondary-600 max-w-2xl mx-auto">
              A high-performance, multi-tenant email marketing platform built with Next.js 15
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <Card variant="elevated">
              <CardHeader>
                <CardTitle>Design System</CardTitle>
                <CardDescription>Explore our design system components</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-secondary-600 mb-4">
                  Our design system includes a comprehensive set of components, colors, and
                  typography.
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  <div className="w-8 h-8 rounded bg-primary"></div>
                  <div className="w-8 h-8 rounded bg-secondary"></div>
                  <div className="w-8 h-8 rounded bg-accent"></div>
                  <div className="w-8 h-8 rounded bg-success"></div>
                  <div className="w-8 h-8 rounded bg-warning"></div>
                  <div className="w-8 h-8 rounded bg-error"></div>
                  <div className="w-8 h-8 rounded bg-info"></div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm">
                  Learn More
                </Button>
              </CardFooter>
            </Card>

            <Card variant="elevated">
              <CardHeader>
                <CardTitle>Button Variants</CardTitle>
                <CardDescription>Different button styles and sizes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary">Primary</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="accent">Accent</Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="link">Link</Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm">Small</Button>
                    <Button size="md">Medium</Button>
                    <Button size="lg">Large</Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </CardFooter>
            </Card>

            <Card variant="elevated">
              <CardHeader>
                <CardTitle>Form Components</CardTitle>
                <CardDescription>Input fields and form elements</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col space-y-4">
                  <Input
                    label="Email Address"
                    placeholder="Enter your email"
                    helperText="We'll never share your email"
                  />
                  <Input label="Password" type="password" placeholder="Enter your password" />
                  <Input
                    label="Error Example"
                    placeholder="Invalid input"
                    error="This field is required"
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="primary">Submit</Button>
              </CardFooter>
            </Card>
          </div>

          <div className="bg-secondary-50 rounded-lg p-8 text-center">
            <h2 className="text-2xl font-bold mb-4 text-secondary-900">Ready to get started?</h2>
            <p className="text-secondary-600 mb-6 max-w-2xl mx-auto">
              Our email marketing platform provides all the tools you need to create, send, and
              analyze your email campaigns.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button variant="primary" size="lg">
                Sign Up Now
              </Button>
              <Button variant="outline" size="lg">
                Learn More
              </Button>
            </div>
          </div>
        </Layout>
      </Main>

      <Footer>
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <Image src="/jetmail-logo.svg" alt="Email Marketing Platform" width={100} height={24} />
            <p className="text-sm text-secondary-500 mt-2">
              © 2025 Email Marketing Platform. All rights reserved.
            </p>
          </div>
          <div className="flex space-x-6">
            <a href="#" className="text-secondary-500 hover:text-secondary-900">
              Terms
            </a>
            <a href="#" className="text-secondary-500 hover:text-secondary-900">
              Privacy
            </a>
            <a href="#" className="text-secondary-500 hover:text-secondary-900">
              Contact
            </a>
          </div>
        </div>
      </Footer>
    </>
  );
}
