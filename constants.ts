
export const INITIAL_REQUIREMENTS = `
Project Overview
Generate a complete C# codebase for a .NET 10.0 (using RC1) solution following the Clean
Architecture pattern, designed for a scalable RESTful API application. The application should
manage a domain of your choice (e.g., inventory, user management, or task tracking), with full
CRUD operations, authentication, OpenTelemetry, and localization/globalization. Structure the
solution with distinct layers: Domain, Application, Infrastructure, and Presentation, ensuring
separation of concerns, dependency inversion, and testability. All projects and namespaces
should be prefaced with “Pd.Starter” (e.g. Pd.Starter.Core , Pd.Starter.Application.Core ).
Solution Structure
Core Layer (Pd.Starter.Core): A basic project for level types like StringUtilities .
Domain Layer (Pd.Starter.Domain): Defines core entities, value objects, domain services,
and interfaces (e.g., repositories, domain events) independent of frameworks. Contains
BaseEntity with multi-tenancy support.
Application Layer (Pd.Starter.Application):
Implements use cases as Commands and Queries, DTOs, and application services,
orchestrating domain logic and coordinating with infrastructure.
Commands and their corresponding handlers should be placed in the same folder,
organized by their purpose. The overall folder structure for commands and queries
should follow Scope/Operation/(*Commandhandler,*Command, *QueryHandler,*Query) .
For example,
Pd.Starter.Application\UsersManagement\DisableUser\DisableUserCommand.cs and
Pd.Starter.Application\UsersManagement\DisableUser\DisableUserCommandHandler.cs .
This layer should primarily contain command/query definitions and handlers. It should
not contain direct service implementations. If a service like a UserService is necessary,
its implementation should reside in the Infrastructure layer.
Mediator Middleware: Include a Mediator pipeline behavior (middleware) within the
Pd.Starter.Application project. This middleware will measure the execution time of
commands and queries and log these durations as OpenTelemetry metrics,
distinguishing between successful completions and failures.
Application Core Layer (Pd.Starter.Application.Core):
Connects the application to the infrastructure projects.
Contains interfaces/abstract classes for services (e.g., IDbService ,
IExternalEmailService ), which are consumed by Pd.Starter.Application and
implemented by Pd.Starter.Infrastructure.* projects.
Defines core interfaces for commands and queries, specifically ICommand<TResponse>
and IQuery<TResponse> , inheriting from Mediator.ICommand<TResponse> andMediator.IQuery<TResponse> respectively. These interfaces are crucial for
Mediator.SourceGenerator .
The responses from commands and queries should be the direct return values, not
wrapped in a generic Result type.
Infrastructure Layer: Handles data persistence, external services, and cross-cutting
concerns.
Pd.Starter.Infrastructure.Database: Contains the Entity Framework Core DbContext ,
DbFactory , and IServices / IApplication setup.
Pd.Starter.Infrastructure.Database.Migrations: Hosts the database migrations. This
project must contain the EF Core snapshot file, migration files (e.g.,
YYYYMMDDHHMMSS_InitialCreate.cs ), and their corresponding designer files (e.g.,
YYYYMMDDHHMMSS_InitialCreate.Designer.cs ). The data folder within
Pd.Starter.Infrastructure.Database should be flattened.
Pd.Starter.Infrastructure.KeycloakSts: Implements STSService to handle all Keycloak
API calls using HttpClient instances obtained from HttpClientFactory for best
practices. This project will also contain the dependency injection setup (e.g.,
StsExtensions class with an AddKeycloakStsServices method) for integrating
Keycloak API communication. The STSService should include a method to check if the
necessary Keycloak realm is set up and, if not, create it with standard settings suitable
for an SPA and Web API application. The Authorization and Authentication setup for
the application should be configured within this project (e.g., JWT bearer token
configuration, OIDC client options).
Pd.Starter.Infrastructure.Localization: Implements the localization and globalization
strategy. It should contain the LocalizedMessagesService , which will return localized
strings based on a provided key. This service must be resilient: if a key does not exist in
the resources, it should return the key as a normalized string (e.g., "UserDoesNotExists"
becomes "User Does Not Exists") and log a warning that the key was not found.
Presentation Layer (Ports): Creates ASP.NET Core applications or services.
Pd.Starter.Port.WebApi: An ASP.NET Core Web API with controllers for CRUD
operations and authentication. It should use
Microsoft.Extensions.ApiDescription.Server to generate an OpenAPI JSON file. This
project will utilize the localization services by checking the Accept-Language HTTP
header for incoming requests and tailoring all outgoing messages (e.g., error messages,
validation messages) to the specified locale.
Pd.Starter.Port.AzureFunctions: An Azure Functions project.
Pd.Starter.Port.WindowsService: A .NET Worker Services project, intended to be
installed and hosted as a Windows service.
Generate a PowerShell script ( install-service.ps1 ) that can install this service.
The script must take parameters from the command line (e.g., ServiceName ,ServiceDisplayName , ServiceDescription , ExecutablePath ) and provide sensible
default values for these parameters if not specified.
Setup a TickerQ service that will run jobs stored in the database as
"ScheduledSystemJob" entities.
All jobs should inherit from IScheduledSystemJob that has an
Execute(JobContext) method where JobContext is a class that has basic job
instance information.
The ScheduledSystemJob Entity should have:
Name
CronString
Status (UserStatus enum: Enabled = 1 , Disabled = 2 ). Default status for
new entities should be Enabled .
Type (fully qualified type name of the job implementation)
Set up the service so that on startup, jobs would be created and run based on their
CronString , using reflection to get the type that should be executed.
React Port Project (Pd.Starter.Port.WebApp): This project will be a TypeScript-based project
that uses React and Vite as its base. You can use a template that uses React, Vite, and Kubb
(optional).
Aspire Host (Pd.Starter.AppHost): A .NET Aspire host project that serves as the startup
project.
It should include using Keycloak via Docker for authentication.
All configurations for Keycloak and other Aspire components should be loaded from an
AppHostSettings class, which in turn sources its values from appsettings.json and
environment variables. No hardcoded values for these settings in Program.cs .
Keycloak Docker container settings (e.g., KC_DB , KC_DB_URL , KEYCLOAK_ADMIN ,
KEYCLOAK_ADMIN_PASSWORD , KC_HOSTNAME , KC_HTTP_PORT , KC_HOSTNAME_STRICT ,
KC_HOSTNAME_STRICT_HTTPS , KC_LOGLEVEL , KC_HEALTH_ENABLED ) must all be retrieved
from the AppHostSettings class.
The Pd.Starter.AppHost should integrate with the application's OpenTelemetry setup
to collect logs, traces, and metrics from all hosted application components.
Additionally, it should host an OpenObserve instance configured to collect these
OpenTelemetry signals.
The .csproj file for Pd.Starter.AppHost should be updated to explicitly reference
Aspire NuGet packages instead of relying on the deprecated Aspire workload.
Port Core Layer (Pd.Starter.Port.Core): Provides basic dependency integration, allowing
other port projects to call extension methods like services.AddInfrastructureServices in
their startup configuration. It will also house the OpenTelemetry setup for logging, tracing,
and metrics, making it available to all ports via extension methods on IServiceCollection .Testing: Include separate test projects for unit and integration tests using TUnit.
Pd.Starter.Application.Tests: Unit tests for the application layer.
Pd.Starter.Port.WebApi.Tests: Integration tests for the Web API endpoints.
Pd.Starter.Port.WindowsService.Tests: Integration tests for the Windows Service.
Use NSubstitute for mocking where appropriate.
NuGet Packages
Mandatory NuGet Packages
Include the following NuGet packages exactly as specified, using the latest stable versions
compatible with .NET 10.0-rc1 (typically .NET 8.0 compatible packages) unless a specific net10.0
preview version is explicitly required. Add packages to the appropriate projects.
Microsoft.Extensions.Configuration
Microsoft.Extensions.DependencyInjection
Microsoft.Extensions.Options.ConfigurationExtensions
Microsoft.Extensions.Configuration.Abstractions
Microsoft.Extensions.Configuration.Binder
Microsoft.Extensions.DependencyInjection.Abstractions
Microsoft.Extensions.Logging.Abstractions
Microsoft.Extensions.Options
Microsoft.Extensions.Primitives
Microsoft.Identity.Client (e.g., 4.60.3 or latest stable 4.x.x )
Microsoft.IdentityModel.Abstractions
Microsoft.IdentityModel.JsonWebTokens
Microsoft.IdentityModel.Logging
Microsoft.IdentityModel.Protocols
Microsoft.IdentityModel.Protocols.OpenIdConnect
Microsoft.IdentityModel.Tokens
Microsoft.IdentityModel.Validators
System.ClientModel
System.Diagnostics.DiagnosticSource
System.IdentityModel.Tokens.Jwt
NodaTime (e.g., 3.1.11 )
Mediator.Abstractions (e.g., 3.0.1 or latest stable 3.x.x )
Mediator.SourceGenerator (e.g., 3.0.1 or latest stable 3.x.x )TUnit (e.g., 0.1.0-alpha01 or latest alpha/stable)
Additional Packages
Add necessary NuGet packages (e.g., Microsoft.EntityFrameworkCore ( 8.0.x ),
Npgsql.EntityFrameworkCore.PostgreSQL ( 8.0.x ),
Npgsql.EntityFrameworkCore.PostgreSQL.NodaTime ( 8.0.x ), Microsoft.AspNetCore.Mvc
( 8.0.x ), Microsoft.AspNetCore.Localization ( 8.0.x ),
Microsoft.AspNetCore.Mvc.Localization ( 8.0.x ), NSubstitute ( 5.x.x ), OpenTelemetry.*
packages ( 1.7.0 or latest stable 1.x.x ), OpenTelemetry.Exporter.OpenObserve (latest
stable), etc.) to support the clean architecture implementation, database access, API
functionality, testing, localization, and OpenTelemetry setup.
For OpenTelemetry, include OpenTelemetry.Extensions.Hosting ,
OpenTelemetry.Instrumentation.AspNetCore , OpenTelemetry.Instrumentation.Http ,
OpenTelemetry.Instrumentation.EntityFrameworkCore ,
OpenTelemetry.Instrumentation.Runtime , OpenTelemetry.Instrumentation.Process ,
and OpenTelemetry.Exporter.OpenTelemetryProtocol .
Ensure all packages are compatible with .NET 10.0 (using RC1). Prioritize stable .NET 8.0
versions for common libraries unless a specific .NET 10.0 preview package is available and
required. Explicitly manage package versions to avoid NU1605 (downgrade) and NU110x
(unable to find) errors.
Implementation Details
Authentication & Authorization: Use OpenID Connect and assume connection to a
Keycloak server. The database/context should have a basic representation of a user,
assuming Keycloak stores most authentication/authorization information. All authentication
and authorization setup, including JWT bearer token configuration and OIDC client
configuration, should be located within Pd.Starter.Infrastructure.KeycloakSts .
Configuration: Utilize Microsoft.Extensions.Configuration for settings management,
loading configurations from appsettings.json , environment variables, and user secrets. All
configuration values, especially for external services like Keycloak and OpenTelemetry,
should be strongly typed using the Microsoft.Extensions.Options pattern.
Dependency Injection: Leverage Microsoft.Extensions.DependencyInjection to register
services and factories across layers.
Data Access: Implement Entity Framework Core with a Postgres Server database, defining
DbContext and migrations in the Infrastructure layer.
The domain layer should have a base Interface and base class for Entity in the database
( BaseEntity ) that would handle Id (UUID v7), CreatedBy (string), CreatedById
(Guid), CreationDate ( NodaTime.Instant ), ModifiedBy (string), ModifiedById (Guid),ModificationDate ( NodaTime.Instant ), Timestamp (byte[] for concurrency), and
TenantId (Guid for multi-tenancy). ID /primary keys should be UUID (version 7).
Do not implement the repository pattern. Instead, create an IDbService (in
Pd.Starter.Application.Core ) that exposes DbSet<TEntity> for entities, allowing
application services to make calls like dbService.DbSet<User>().Where(x => x.Id ==
userId) and await dbService.SaveChangesAsync() . IDbService should expose DbSet
and not IQueryable to restrict direct query materialization.
API: Create RESTful endpoints in the Presentation layer using ASP.NET Core, with proper
error handling, validation, and OpenAPI (Swagger) documentation. It should use
Microsoft.Extensions.ApiDescription.Server to generate an OpenAPI JSON file.
Testing: Implement unit tests for application services and integration tests for API endpoints
and Windows Service, using NSubstitute for mocks where appropriate.
OpenTelemetry:
Set up OpenTelemetry for logging, tracing, and metrics.
The setup (configuration of TracerProvider , MeterProvider , LoggerProvider with
appropriate exporters like OTLP and instrumentation for ASP.NET Core, HTTP, Entity
Framework Core, Process, Runtime) should be centralized in Pd.Starter.Port.Core via
an IServiceCollection extension method ( AddOpenTelemetryServices ).
All OpenTelemetry settings, including the OTLP exporter endpoint, should be loaded
from a dedicated settings class (e.g., OpenTelemetrySettings ) rather than being
hardcoded in Program.cs .
Localization and Globalization:
Implement a localization strategy that allows all outgoing messages (API responses,
validation errors, log messages) to be tailored to the user's language.
The application should determine the user's preferred language by inspecting the
Accept-Language HTTP header.
The localization setup should primarily reside in
Pd.Starter.Infrastructure.Localization , including resource files ( .resx ) and a
LocalizedMessagesService .
The LocalizedMessagesService should be resilient: if a localization key is not found, it
should return the key as a "normalized string" (e.g., UserNotFoundKey -> "User Not
Found Key") and log a Warning message indicating the missing key.
GitIgnore: Generate a suitable .gitignore file.
Specific Entities and Commands
User Entity: Create a User Entity that inherits from BaseEntity .
The entity should have these properties:
Username (string)STSId (string, uniquely identifying the user in Keycloak)
EmailAddress (string)
ContactNumber (string, optional)
Status (UserStatus enum: Active = 1 , Disabled = 2 . Default for new users
should be Active .)
Migration: Create a migration that would create the table for this entity. (As in, write the
code for the migration, its snapshot, and the designer file within
Pd.Starter.Infrastructure.Database.Migrations ).
Application Commands/Queries:
Login command: This should make API calls to the Keycloak instance to perform
authentication (e.g., Authorization Code Flow with PKCE). The LoginCommand and its
LoginCommandHandler should reside in
Pd.Starter.Application\UsersManagement\Login\ folder.
GetUser query: Retrieves user details based on internal ID.
NewUser command: Creates a new user in the application and potentially registers
them with Keycloak.
DisableUser command: Changes a user's Status to Disabled .
GetUserFromSTS query: Makes an API call to Keycloak to get user information based on
a Keycloak user ID ( STSId ).
Controller: Create an UsersController (or similar endpoint structure using minimal APIs)
that would implement these command/query operations for the Pd.Starter.Port.WebApi
project.
Code Quality
Follow C# coding standards (e.g., PascalCase for public members, meaningful naming).
Use async / await for I/O-bound operations (e.g., database calls).
Implement domain-driven design principles, such as aggregates and domain events, where
applicable.
Ensure the codebase is modular, maintainable, and ready for production deployment (e.g.,
compatible with Azure or Docker).
Output
Generate a complete solution directory structure with all necessary files (e.g., .sln ,
.csproj , C# source files, appsettings.json , tests).
Provide a README.md explaining the project structure, how to build/run the application, and
any setup instructions (e.g., database configuration, Keycloak setup).Generate the install-service.ps1 script for the Windows Service.
Generate the rename-project.ps1 PowerShell script.
Generate a build.cake file and an updated deploy.json file for build automation.
Generate a .gitignore file.
Constraints
Ensure compatibility with .NET 10.0 (RC1).
Avoid unnecessary dependencies beyond those specified or justified.
Do not use external file imports or resources not included in the solution.
All projects should have project files ( .csproj ).
Don't use AutoMapper or any other mapping packages. If mapping is needed, do it
manually.
Ensure that the projects load in Visual Studio and do not get the error: error : At most one
of the include, remove, and update attributes may be specified for an item element.
Ensure all package references are correct, checking each for proper naming and versions
(e.g., Npgsql.EntityFrameworkCore.PostgreSQL.NodaTime for NodaTime integration with EF
Core PostgreSQL).
README.md Content
When adding a README.md markdown, add a section called "How to think about and
expand/maintain project".
One point should be: "Note that the Application project is the source of truth for business
logic and what the application produces and CONSUMES. So if you want to use SendGrid as
an email client, you aren't just adding SendGrid; no. The Application requires an
IExternalEmailService that interacts with an email model (all to be found in
Application.Core project), and SendGrid is one implementation of this. Thinking about it
this way will help you remember where to put things."
`;
