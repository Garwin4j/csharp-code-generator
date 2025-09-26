
export const INITIAL_REQUIREMENTS = `
Generate a complete C# codebase for a .NET 10.0 (using RC1) solution following the Clean Architecture pattern, designed for a scalable RESTful API application. The application should manage a domain of your choice (e.g., inventory, user management, or task tracking), with full CRUD operations, authentication, opentelemetry. Structure the solution with distinct layers: Domain, Application, Infrastructure, and Presentation, ensuring separation of concerns, dependency inversion, and testability. All projects and namespaces should be prefaced with "Pd.Starter" (e.g. Pd.Starter.Core, Pd.Starter.Application.Core)

Requirements:

1. Solution Structure:
- Core Layer (Pd.Starter.Core): Basic project that would have level types like String Utilities.
- Domain Layer (Pd.Starter.Domain.*): Define core entities, value objects, domain services, and interfaces (e.g., repositories, domain events) independent of frameworks.
- Application Layer(Pd.Starter.Application.*): Implement use cases, DTOs, and application services, orchestrating domain logic and coordinating with infrastructure. There should be a Pd.Starter.Application.Core project that connect the application to the infrastructure projects and contains the interfaces/abstract classes of the services. In other words, if the application layer (Pd.Starter.Application) uses a service (e.g. DbService), the interface/abstraction should be defined in Pd.Starter.Application.Core and imported by Pd.Starter.Application to be used and imported by Pd.Starter.Infrastructure.Database for the implementation. There should be a Pd.Starter.Port.Core that does some basic dependency integration so that the port projects can call code like "services.AddInfrastructureServices" in the programs setup.
- Infrastructure Layer: Handle data persistence (using Entity Framework Core with SQL Server), external services (e.g., Microsoft Graph), and cross-cutting concerns (e.g., logging, configuration). There should be a separate infrastructure project that contain the efcore context, dbFactory and IServices and application setup (Pd.Starter.Infrastructure.Database). There should be another project to host the database migrations (Pd.Starter.Infrastructure.Database.Migrations).
- Presentation Layer: Create an ASP.NET Core Web API with controllers, minimal APIs, or endpoints for CRUD operations and authentication. Presentation layer should be called "Port" (e.g. Pd.Starter.Port.WebApi). There are three main ports, A WebApi, A Azure Functions and a Windows Service Port.
- There should also be a react port project: This project will be a Typescript based project that uses react, vite as it bases. You can use a template that uses react, vite and kubb (optional)
- Include a separate test project for unit and integration tests using TUnit.

2. Implementation Details:
- Authentication: Use OpenIDConnect and assume you are connecting to a Keyclock server for authentication and authorization. The database/context should have a basic representation of user while assuming that keyclock would store most of the authentication/authorization information.
- Data Access: Implement Entity Framework Core with a Postgres Server database, defining DbContext and migrations in the Infrastructure layer. The domain layer should have a base Interface and base class for Entity in the database (BaseEntity) that would handle ids like CreatedBy, CreatedById, CreationDate, ModifiedBy, ModifiedById and ModificationDate, timestamp, TenantId (the application should support multi-tenancy). ID/primary keys should be UUID (version 7).
- API: Create RESTful endpoints in the Presentation layer using ASP.NET Core, with proper error handling, validation, and OpenAPI (Swagger) documentation. It should use Microsoft.Extensions.ApiDescription.Server to generate a openapi json file.
- Testing: Include unit tests for application services and integration tests for API endpoints, using mocks where appropriate.

3. Code Quality:
- Follow C# coding standards (e.g., PascalCase for public members, meaningful naming).
- Use async/await for I/O-bound operations (e.g., database calls).
- Implement domain-driven design principles, such as aggregates and domain events, where applicable.
- Ensure the codebase is modular, maintainable, and ready for production deployment (e.g., compatible with Azure or Docker).

4. Implementations:
- Create a User Entity that inherits from BaseEntity.
- The entity should have these properties: Username, STSId, EmailAddress, ContactNumber, Status (Active,Disabled).
- Create a migration that would create the table for this entity.
- Create The application Command: Login, GetUser, NewUser, DisableUser, GetUserFromSTS. This should make an api call to get some information from Keycloak based on a keycloak userId (STSId).
- All keycloak api calls should be done through a service called STSService that would expose methods to make these calls (in a async way). The implementation should be done project called Pd.Starter.Infrastructure.Sts and should import whatever packages needed to communicate with keycloak on a api level. Remember to do the DI setup in a StsExtensions class to add a method to the ServiceCollection class.
- Create a Controller that would implement these.
`;
