import PublicLayout from '@/components/layout/PublicLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { 
  Heart, 
  Trophy, 
  Star, 
  Lightbulb, 
  Target, 
  Eye, 
  Check, 
  BookOpen, 
  Users,
  Award,
  Building2,
  GraduationCap
} from 'lucide-react';

interface SettingsData {
  schoolName: string;
  schoolMotto: string;
  schoolAddress: string;
}

export default function About() {
  const { data: settings } = useQuery<SettingsData>({
    queryKey: ["/api/public/settings"],
    refetchInterval: 5000,
  });

  const schoolName = settings?.schoolName || "Treasure-Home School";
  const schoolMotto = settings?.schoolMotto || "Honesty and Success";
  const schoolAddress = settings?.schoolAddress || "Seriki-Soyinka, Ifo, Ogun State, Nigeria";

  const values = [
    {
      title: 'Honesty',
      description: 'We believe in fostering integrity and truthfulness in all aspects of our educational journey.',
      icon: Heart,
      color: 'red'
    },
    {
      title: 'Success',
      description: 'We are committed to achieving excellence in academics, character development, and life skills.',
      icon: Trophy,
      color: 'primary'
    },
    {
      title: 'Excellence',
      description: 'We strive for the highest standards in teaching, learning, and personal development.',
      icon: Star,
      color: 'yellow'
    },
    {
      title: 'Innovation',
      description: 'We embrace modern teaching methods and technology to enhance the learning experience.',
      icon: Lightbulb,
      color: 'secondary'
    }
  ];

  const facilities = [
    'Modern classrooms with interactive whiteboards',
    'Fully equipped science and computer laboratories',
    'Well-stocked library with digital resources',
    'Sports facilities including football field and basketball court',
    'Arts and music rooms for creative expression',
    'Safe and secure school environment',
    'Transportation services',
    'Nutritious meal programs'
  ];

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="hero-gradient py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl lg:text-5xl font-bold text-primary-foreground mb-6" data-testid="text-about-title">
            About {schoolName}
          </h1>
          <p className="text-xl text-primary-foreground/90 max-w-3xl mx-auto" data-testid="text-about-subtitle">
            {schoolMotto}
          </p>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <Card className="shadow-sm border border-border" data-testid="card-mission">
              <CardContent className="p-8">
                <div className="bg-primary/10 w-16 h-16 rounded-lg flex items-center justify-center mb-6">
                  <Target className="text-primary h-8 w-8" />
                </div>
                <h2 className="text-2xl font-bold mb-4" data-testid="text-mission-title">Our Mission</h2>
                <p className="text-muted-foreground leading-relaxed" data-testid="text-mission-content">
                  To provide quality education that develops the whole child - intellectually, morally, physically, and socially. 
                  We are committed to fostering honesty, success, and excellence in every student while preparing them for 
                  leadership roles in society.
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border border-border" data-testid="card-vision">
              <CardContent className="p-8">
                <div className="bg-secondary/10 w-16 h-16 rounded-lg flex items-center justify-center mb-6">
                  <Eye className="text-secondary h-8 w-8" />
                </div>
                <h2 className="text-2xl font-bold mb-4" data-testid="text-vision-title">Our Vision</h2>
                <p className="text-muted-foreground leading-relaxed" data-testid="text-vision-content">
                  To be the leading educational institution in Ogun State, recognized for academic excellence, 
                  moral integrity, and the holistic development of students who become productive and responsible 
                  citizens of Nigeria and the world.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4" data-testid="text-values-title">
              Our Core Values
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto" data-testid="text-values-description">
              These fundamental principles guide everything we do at {schoolName}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <Card key={index} className="card-hover shadow-sm border border-border" data-testid={`card-value-${index}`}>
                <CardContent className="p-6 text-center">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                    value.color === 'red' ? 'bg-red-100' :
                    value.color === 'primary' ? 'bg-primary/10' :
                    value.color === 'yellow' ? 'bg-yellow-100' :
                    'bg-secondary/10'
                  }`}>
                    <value.icon className={`h-6 w-6 ${
                      value.color === 'red' ? 'text-red-600' :
                      value.color === 'primary' ? 'text-primary' :
                      value.color === 'yellow' ? 'text-yellow-600' :
                      'text-secondary'
                    }`} />
                  </div>
                  <h3 className="text-lg font-semibold mb-3" data-testid={`text-value-title-${index}`}>
                    {value.title}
                  </h3>
                  <p className="text-muted-foreground text-sm" data-testid={`text-value-description-${index}`}>
                    {value.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* School History */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-6" data-testid="text-history-title">
                Our Journey
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p data-testid="text-history-p1">
                  Established with a big vision - to provide quality education that transforms lives, 
                  {schoolName} is located in the heart of {schoolAddress}.
                </p>
                <p data-testid="text-history-p2">
                  From our humble beginnings, we have grown to become 
                  one of the most respected educational institutions in the region, serving students 
                  from playgroup to senior secondary school.
                </p>
                <p data-testid="text-history-p3">
                  Our consistent track record of academic excellence, with 95% success rate in external 
                  examinations, stands as a testament to our commitment to quality education and the 
                  dedication of our outstanding teaching staff.
                </p>
              </div>
            </div>
            <div>
              <img 
                src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400" 
                alt="Treasure-Home School building and campus" 
                className="rounded-xl shadow-lg w-full"
                data-testid="img-school-building"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Facilities */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4" data-testid="text-facilities-title">
              Our Facilities
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto" data-testid="text-facilities-description">
              Modern infrastructure designed to support comprehensive learning and development
            </p>
          </div>

          <Card className="shadow-sm border border-border" data-testid="card-facilities">
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {facilities.map((facility, index) => (
                  <div key={index} className="flex items-center space-x-3" data-testid={`facility-${index}`}>
                    <div className="bg-primary/10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
                      <i className="fas fa-check text-primary text-sm"></i>
                    </div>
                    <span className="text-foreground">{facility}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-6" data-testid="text-cta-title">
            Join the {schoolName} Family
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto" data-testid="text-cta-description">
            Experience the difference that quality education and moral excellence can make in your child's life. 
            Discover why parents trust us with their children's future.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-primary text-primary-foreground px-8 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors" data-testid="button-schedule-visit">
              Schedule a Visit
            </button>
            <button className="border border-border text-foreground px-8 py-3 rounded-lg font-semibold hover:bg-muted transition-colors" data-testid="button-download-brochure">
              Download Brochure
            </button>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
