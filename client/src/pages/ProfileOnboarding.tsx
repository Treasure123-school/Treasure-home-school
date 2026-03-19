import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, UserCircle, MapPin, Briefcase, Shield } from "lucide-react";
import { ROLE_IDS, getPortalByRoleId } from "@/lib/roles";

// Onboarding form schema
const onboardingSchema = z.object({
  // Personal Information
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  
  // Contact Information
  address: z.string().min(5, "Address is required"),
  state: z.string().min(2, "State is required"),
  country: z.string().min(2, "Country is required"),
  
  // Role-specific fields (dynamic based on role)
  qualifications: z.string().optional(),
  yearsOfExperience: z.number().optional(),
  department: z.string().optional(),
  position: z.string().optional(),
  accessLevel: z.string().optional(),
  responsibilities: z.string().optional(),
  occupation: z.string().optional(),
  emergencyContact: z.string().optional(),
  guardianName: z.string().optional(),
  
  // Security
  securityQuestion: z.string().min(5, "Security question is required"),
  securityAnswer: z.string().min(3, "Security answer is required"),
  dataPolicyAgreed: z.boolean().refine((val) => val === true, {
    message: "You must agree to the data policy"
  })
});

type OnboardingFormData = z.infer<typeof onboardingSchema>;

export default function ProfileOnboarding() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentRole, setCurrentRole] = useState<number>(0);

  // Fetch current profile
  const { data: profileData, isLoading } = useQuery({
    queryKey: ["/api/profile/me"],
  });

  const form = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "",
      phone: "",
      address: "",
      state: "",
      country: "",
      securityQuestion: "",
      securityAnswer: "",
      dataPolicyAgreed: false,
    }
  });

  // Set role when profile data loads
  useEffect(() => {
    if (profileData && (profileData as any).user) {
      const data = profileData as any;
      setCurrentRole(data.user.roleId);
      
      // Pre-fill form with existing data
      const user = data.user;
      form.reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        dateOfBirth: user.dateOfBirth || "",
        gender: user.gender || "",
        phone: user.phone || "",
        address: user.address || "",
        state: user.state || "",
        country: user.country || "",
        securityQuestion: user.securityQuestion || "",
        securityAnswer: "",
        dataPolicyAgreed: user.dataPolicyAgreed || false,
        
        // Role-specific
        qualifications: data.roleProfile?.qualifications || "",
        yearsOfExperience: data.roleProfile?.yearsOfExperience || undefined,
        department: data.roleProfile?.department || "",
        position: data.roleProfile?.position || "",
        accessLevel: data.roleProfile?.accessLevel || "",
        responsibilities: data.roleProfile?.responsibilities || "",
        occupation: data.roleProfile?.occupation || "",
        emergencyContact: data.roleProfile?.emergencyContact || "",
        guardianName: data.roleProfile?.guardianName || "",
      });
    }
  }, [profileData]);

  // Submit mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: OnboardingFormData) => {
      const payload = {
        personalInfo: {
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: data.dateOfBirth,
          gender: data.gender,
        },
        contactInfo: {
          phone: data.phone,
          address: data.address,
          state: data.state,
          country: data.country,
        },
        roleSpecific: getRoleSpecificData(data),
        security: {
          securityQuestion: data.securityQuestion,
          securityAnswer: data.securityAnswer,
          dataPolicyAgreed: data.dataPolicyAgreed,
        }
      };

      const response = await fetch("/api/profile/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update profile");
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/me"] });
      toast({
        title: "Profile Updated",
        description: `Your profile is ${data.completionPercentage}% complete!`,
      });
      
      if (data.profileCompleted) {
        // Redirect to dashboard based on role using centralized role utilities
        navigate(getPortalByRoleId(currentRole));
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    }
  });

  const getRoleSpecificData = (data: OnboardingFormData) => {
    switch(currentRole) {
      case ROLE_IDS.TEACHER: // roleId 3
        return {
          qualifications: data.qualifications,
          yearsOfExperience: data.yearsOfExperience,
          department: data.department,
        };
      case ROLE_IDS.ADMIN: // roleId 2
        return {
          position: data.position,
          accessLevel: data.accessLevel,
          responsibilities: data.responsibilities,
        };
      case ROLE_IDS.PARENT: // roleId 5
        return {
          occupation: data.occupation,
          emergencyContact: data.emergencyContact,
        };
      case ROLE_IDS.STUDENT: // roleId 4
        return {
          guardianName: data.guardianName,
        };
      case ROLE_IDS.SUPER_ADMIN: // roleId 1
        return {};
      default:
        return {};
    }
  };

  const onSubmit = (data: OnboardingFormData) => {
    updateProfileMutation.mutate(data);
  };

  const getRoleName = () => {
    const roleNames: Record<string, string> = {
      "1": "Student",
      "2": "Teacher",
      "3": "Parent",
      "4": "Admin"
    };
    return roleNames[currentRole] || "User";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  const completionPercentage = profileData ? (profileData as any).completionPercentage || 0 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Complete Your Profile
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Welcome! Please fill in your information to get started as a {getRoleName()}.
          </p>
        </div>

        {/* Progress Bar */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Profile Completion</CardTitle>
            <CardDescription>{completionPercentage}% Complete</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={completionPercentage} className="h-2" data-testid="progress-completion" />
          </CardContent>
        </Card>

        {/* Onboarding Form */}
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <UserCircle className="h-5 w-5 text-primary" />
                <CardTitle>Personal Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    {...form.register("firstName")}
                    data-testid="input-firstName"
                  />
                  {form.formState.errors.firstName && (
                    <p className="text-sm text-red-500 mt-1">{form.formState.errors.firstName.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    {...form.register("lastName")}
                    data-testid="input-lastName"
                  />
                  {form.formState.errors.lastName && (
                    <p className="text-sm text-red-500 mt-1">{form.formState.errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    {...form.register("dateOfBirth")}
                    data-testid="input-dateOfBirth"
                  />
                </div>
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <Select onValueChange={(value) => form.setValue("gender", value)}>
                    <SelectTrigger data-testid="select-gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <CardTitle>Contact Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  {...form.register("phone")}
                  data-testid="input-phone"
                />
                {form.formState.errors.phone && (
                  <p className="text-sm text-red-500 mt-1">{form.formState.errors.phone.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="address">Address *</Label>
                <Textarea
                  id="address"
                  {...form.register("address")}
                  data-testid="input-address"
                />
                {form.formState.errors.address && (
                  <p className="text-sm text-red-500 mt-1">{form.formState.errors.address.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="state">State *</Label>
                  <Input
                    id="state"
                    {...form.register("state")}
                    data-testid="input-state"
                  />
                  {form.formState.errors.state && (
                    <p className="text-sm text-red-500 mt-1">{form.formState.errors.state.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="country">Country *</Label>
                  <Input
                    id="country"
                    {...form.register("country")}
                    data-testid="input-country"
                  />
                  {form.formState.errors.country && (
                    <p className="text-sm text-red-500 mt-1">{form.formState.errors.country.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Role-Specific Fields */}
          {currentRole === ROLE_IDS.TEACHER && (
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  <CardTitle>Teacher Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="qualifications">Qualifications</Label>
                  <Input
                    id="qualifications"
                    placeholder="e.g., M.Ed, B.Sc"
                    {...form.register("qualifications")}
                    data-testid="input-qualifications"
                  />
                </div>
                <div>
                  <Label htmlFor="yearsOfExperience">Years of Experience</Label>
                  <Input
                    id="yearsOfExperience"
                    type="number"
                    {...form.register("yearsOfExperience", { valueAsNumber: true })}
                    data-testid="input-yearsOfExperience"
                  />
                </div>
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    placeholder="e.g., Mathematics"
                    {...form.register("department")}
                    data-testid="input-department"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {currentRole === ROLE_IDS.ADMIN && (
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  <CardTitle>Admin Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="position">Position</Label>
                  <Input
                    id="position"
                    placeholder="e.g., Principal, Vice Principal"
                    {...form.register("position")}
                    data-testid="input-position"
                  />
                </div>
                <div>
                  <Label htmlFor="accessLevel">Access Level</Label>
                  <Select onValueChange={(value) => form.setValue("accessLevel", value)}>
                    <SelectTrigger data-testid="select-accessLevel">
                      <SelectValue placeholder="Select access level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full Access</SelectItem>
                      <SelectItem value="limited">Limited Access</SelectItem>
                      <SelectItem value="read-only">Read Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="responsibilities">Responsibilities</Label>
                  <Textarea
                    id="responsibilities"
                    {...form.register("responsibilities")}
                    data-testid="input-responsibilities"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {currentRole === ROLE_IDS.PARENT && (
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  <CardTitle>Parent Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="occupation">Occupation</Label>
                  <Input
                    id="occupation"
                    {...form.register("occupation")}
                    data-testid="input-occupation"
                  />
                </div>
                <div>
                  <Label htmlFor="emergencyContact">Emergency Contact</Label>
                  <Input
                    id="emergencyContact"
                    type="tel"
                    {...form.register("emergencyContact")}
                    data-testid="input-emergencyContact"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {currentRole === ROLE_IDS.STUDENT && (
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  <CardTitle>Student Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="guardianName">Guardian Name</Label>
                  <Input
                    id="guardianName"
                    {...form.register("guardianName")}
                    data-testid="input-guardianName"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle>Security & Privacy</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="securityQuestion">Security Question *</Label>
                <Input
                  id="securityQuestion"
                  placeholder="e.g., What is your favorite book?"
                  {...form.register("securityQuestion")}
                  data-testid="input-securityQuestion"
                />
                {form.formState.errors.securityQuestion && (
                  <p className="text-sm text-red-500 mt-1">{form.formState.errors.securityQuestion.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="securityAnswer">Security Answer *</Label>
                <Input
                  id="securityAnswer"
                  type="password"
                  {...form.register("securityAnswer")}
                  data-testid="input-securityAnswer"
                />
                {form.formState.errors.securityAnswer && (
                  <p className="text-sm text-red-500 mt-1">{form.formState.errors.securityAnswer.message}</p>
                )}
              </div>

              <div className="flex items-start space-x-2">
                <input
                  type="checkbox"
                  id="dataPolicyAgreed"
                  {...form.register("dataPolicyAgreed")}
                  className="mt-1"
                  data-testid="checkbox-dataPolicyAgreed"
                />
                <Label htmlFor="dataPolicyAgreed" className="text-sm leading-tight">
                  I agree to the data privacy policy and consent to the collection and processing of my personal information *
                </Label>
              </div>
              {form.formState.errors.dataPolicyAgreed && (
                <p className="text-sm text-red-500">{form.formState.errors.dataPolicyAgreed.message}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardFooter className="flex justify-between pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/portal/dashboard")}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateProfileMutation.isPending}
                data-testid="button-submit"
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Profile"
                )}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </div>
  );
}
