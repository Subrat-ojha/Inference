import { useEffect, useMemo, useState } from 'react'
import AuthGate, { type SignedInUser } from './AuthGate'
import { AuthSessionError, getAccessToken } from './auth'
import EnglishPractice from './EnglishPractice'
import Schedule from './Schedule'
import WeekendPlanner from './WeekendPlanner'
import NotesVault, { vaultDemoNotes } from './NotesVault'

type Task = {
  id: string
  title: string
  detail: string
}

type Reading = {
  title: string
  detail: string
  url: string
}

type Stage = {
  id: number
  title: string
  outcome: string
  hoursTarget: number
  reading: Reading[]
  tasks: Task[]
  tools?: string[]
  signal?: string
}

type StageState = {
  completed: string[]
  hours: number
  notes: string
}

type TrackerState = Record<number, StageState>
type TrackId = 'inference' | 'java'
type TrackerByTrack = Record<TrackId, TrackerState>
type ActiveStages = Record<TrackId, number>
type PersistedTracker = {
  version: 3
  tracks: TrackerByTrack
  activeStages: ActiveStages
  selectedTrack: TrackId
}
type SyncStatus = 'loading' | 'saving' | 'saved' | 'offline' | 'local' | 'demo'
type Theme = 'light' | 'dark'
type PrimarySection = 'roadmap' | 'vault' | 'english' | 'planner' | 'schedule'

const STORAGE_KEY = 'engineering-track:v3'
const LEGACY_STORAGE_KEY = 'inference-track:v2'
const ACTIVE_STAGE_KEY = 'inference-track:active-stage:v2'
const RESET_PENDING_KEY = 'inference-track:reset-pending:v1'
const THEME_KEY = 'inference-track:theme:v1'
const API_URL = (
  (import.meta.env.VITE_TRACKER_API_URL as string | undefined)
  ?? 'https://br-odd-scene-b5xcgi0s-tracker.compute.c-7.us-east-2.aws.neon.tech'
).replace(/\/$/, '')

const inferenceStages: Stage[] = [
  {
    id: 1,
    title: 'Python foundations',
    outcome: 'Run a tiny Python data script',
    hoursTarget: 1,
    reading: [
      {
        title: 'The Python Tutorial · Sections 3–4',
        detail: 'Read values, lists, conditions, loops, and functions. Stop before advanced function options.',
        url: 'https://docs.python.org/3/tutorial/introduction.html',
      },
      {
        title: 'NumPy · Absolute basics for beginners',
        detail: 'Skim array creation, shape, dimensions, indexing, and simple aggregation.',
        url: 'https://numpy.org/doc/stable/user/absolute_beginners.html',
      },
    ],
    tasks: [
      { id: 'python-run', title: 'Run one Python script', detail: 'Create a virtual environment, install NumPy, and print the mean of five numbers.' },
      { id: 'numpy-shapes', title: 'Inspect one array', detail: 'Create a 2 × 3 array and print its shape, data type, and first row.' },
    ],
  },
  {
    id: 2,
    title: 'Machine learning basics',
    outcome: 'Train and evaluate one tiny model',
    hoursTarget: 1,
    reading: [
      {
        title: 'Google · Machine Learning Crash Course',
        detail: 'Read the introduction and linear regression overview. Focus on features, labels, predictions, and loss.',
        url: 'https://developers.google.com/machine-learning/crash-course',
      },
      {
        title: 'scikit-learn · Model evaluation',
        detail: 'Skim train/test separation, accuracy, precision, and recall. Ignore the long metric catalog for now.',
        url: 'https://scikit-learn.org/stable/modules/model_evaluation.html',
      },
    ],
    tasks: [
      { id: 'ml-language', title: 'Label the moving parts', detail: 'For a house-price example, write down the features, label, prediction, and possible error.' },
      { id: 'sklearn-model', title: 'Run a small classifier', detail: 'Load Iris, split the data, fit logistic regression, and print test accuracy.' },
    ],
  },
  {
    id: 3,
    title: 'Neural networks',
    outcome: 'Follow one PyTorch training loop',
    hoursTarget: 1,
    reading: [
      {
        title: 'PyTorch · Learn the Basics',
        detail: 'Read Quickstart and Tensors. Notice tensor shapes and where the model, loss, and optimizer appear.',
        url: 'https://docs.pytorch.org/tutorials/beginner/basics/',
      },
      {
        title: 'PyTorch · Building a neural network',
        detail: 'Skim layers, the forward pass, and model parameters. Do not memorize every class.',
        url: 'https://docs.pytorch.org/tutorials/beginner/basics/buildmodel_tutorial.html',
      },
    ],
    tasks: [
      { id: 'run-quickstart', title: 'Run the official quickstart', detail: 'Use its Colab link or local notebook and identify the data, model, loss, and optimizer lines.' },
      { id: 'change-training', title: 'Change one training setting', detail: 'Change epochs or learning rate, rerun, and note whether the loss changes differently.' },
    ],
  },
  {
    id: 4,
    title: 'Transformers & LLMs',
    outcome: 'Tokenize text and run a small language model',
    hoursTarget: 1,
    reading: [
      {
        title: 'Hugging Face · LLM Course introduction',
        detail: 'Read the overview of NLP, LLMs, Transformers, and the course prerequisites.',
        url: 'https://huggingface.co/learn/llm-course/chapter1/1',
      },
      {
        title: 'Hugging Face · Basic model usage',
        detail: 'Review the chapter recap for tokenizers, input IDs, attention masks, and model outputs.',
        url: 'https://huggingface.co/learn/llm-course/chapter2/7',
      },
    ],
    tasks: [
      { id: 'tokenization', title: 'Compare token counts', detail: 'Tokenize two short sentences and print their tokens and input ID shapes.' },
      { id: 'run-llm', title: 'Generate a short response', detail: 'Use a small text-generation pipeline in Colab and limit the output to a few tokens.' },
    ],
  },
  {
    id: 5,
    title: 'Inference mechanics',
    outcome: 'See why generation takes time and memory',
    hoursTarget: 1,
    reading: [
      {
        title: 'Transformers · Generation strategies',
        detail: 'Read greedy decoding and sampling. Focus on what temperature and top-p change.',
        url: 'https://huggingface.co/docs/transformers/generation_strategies',
      },
      {
        title: 'Transformers · KV cache strategies',
        detail: 'Read the opening explanation and default cache section. Learn why cache saves compute but uses memory.',
        url: 'https://huggingface.co/docs/transformers/kv_cache',
      },
    ],
    tasks: [
      { id: 'generation-compare', title: 'Compare two decoding settings', detail: 'Run the same prompt once greedily and once with sampling; note how the output changes.' },
      { id: 'latency-compare', title: 'Time two prompt lengths', detail: 'Generate the same number of output tokens from a short and longer prompt and compare elapsed time.' },
    ],
  },
  {
    id: 6,
    title: 'Model serving',
    outcome: 'Understand how a model becomes an API',
    hoursTarget: 1,
    reading: [
      {
        title: 'vLLM · Quickstart',
        detail: 'Read prerequisites, installation, and Online Serving. Focus on the server command and request flow.',
        url: 'https://docs.vllm.ai/en/latest/getting_started/quickstart/',
      },
      {
        title: 'vLLM · OpenAI-compatible server',
        detail: 'Skim the chat completions endpoint and the client example. Ignore advanced server flags.',
        url: 'https://docs.vllm.ai/en/latest/serving/openai_compatible_server/',
      },
    ],
    tasks: [
      { id: 'serving-map', title: 'Trace one request', detail: 'Write the path: client → server → tokenizer → model → generated tokens → response.' },
      { id: 'serve-model', title: 'Run or annotate the quickstart', detail: 'If hardware allows, start a small server. Otherwise, copy the command and explain every argument.' },
    ],
  },
  {
    id: 7,
    title: 'APIs & integration',
    outcome: 'Build and call one small Python API',
    hoursTarget: 1,
    reading: [
      {
        title: 'FastAPI · First Steps',
        detail: 'Read app creation, path operations, running the server, and interactive API docs.',
        url: 'https://fastapi.tiangolo.com/tutorial/first-steps/',
      },
      {
        title: 'FastAPI · StreamingResponse',
        detail: 'Skim how an iterator can send response chunks instead of buffering everything first.',
        url: 'https://fastapi.tiangolo.com/advanced/custom-response/#streamingresponse',
      },
    ],
    tasks: [
      { id: 'health-route', title: 'Create a health endpoint', detail: 'Build a FastAPI app with GET /health returning a small JSON response.' },
      { id: 'call-api', title: 'Call the endpoint', detail: 'Use Python requests or curl, then add one required text field to a POST route.' },
    ],
  },
  {
    id: 8,
    title: 'Benchmarking',
    outcome: 'Measure one repeatable inference workload',
    hoursTarget: 1,
    reading: [
      {
        title: 'vLLM · Benchmark CLI',
        detail: 'Find input length, output length, request count, concurrency, and saved result options.',
        url: 'https://docs.vllm.ai/en/latest/benchmarking/cli/',
      },
      {
        title: 'vLLM · Performance dashboard',
        detail: 'Read how serving tests separate throughput, time to first token, and time per output token.',
        url: 'https://docs.vllm.ai/en/latest/benchmarking/dashboard/',
      },
    ],
    tasks: [
      { id: 'workload', title: 'Define a tiny workload', detail: 'Fix one model, prompt length, output length, and ten repeated requests.' },
      { id: 'metrics', title: 'Record three numbers', detail: 'Capture first-token latency, total latency, and output tokens per second.' },
    ],
  },
  {
    id: 9,
    title: 'Optimization',
    outcome: 'Compare one optimization with a baseline',
    hoursTarget: 1,
    reading: [
      {
        title: 'Transformers · Optimization overview',
        detail: 'Read the speed-versus-memory table and the short sections on caching and quantization.',
        url: 'https://huggingface.co/docs/transformers/optimization_overview',
      },
      {
        title: 'Transformers · Quantization concepts',
        detail: 'Read bit width, scale, post-training quantization, and why lower precision can affect quality.',
        url: 'https://huggingface.co/docs/transformers/quantization/concept_guide',
      },
    ],
    tasks: [
      { id: 'choose-change', title: 'Choose one change', detail: 'Pick caching, quantization, or batching and write what speed, memory, or quality it may affect.' },
      { id: 'compare-runs', title: 'Compare before and after', detail: 'Keep the prompt and output length fixed; record runtime, memory if available, and output differences.' },
    ],
  },
  {
    id: 10,
    title: 'GPU systems',
    outcome: 'Identify the main GPU memory users',
    hoursTarget: 1,
    reading: [
      {
        title: 'PyTorch · CUDA semantics',
        detail: 'Read device selection and CUDA memory management. Skip multi-GPU details for now.',
        url: 'https://docs.pytorch.org/docs/stable/notes/cuda.html',
      },
      {
        title: 'PyTorch · torch.cuda reference',
        detail: 'Find is_available, memory_allocated, memory_reserved, and get_device_properties.',
        url: 'https://docs.pytorch.org/docs/stable/cuda.html',
      },
    ],
    tasks: [
      { id: 'cuda-check', title: 'Inspect the available device', detail: 'Print CUDA availability, device name, total memory, allocated memory, and reserved memory.' },
      { id: 'memory-map', title: 'Draw a four-part memory map', detail: 'List model weights, KV cache, temporary tensors, and runtime overhead in plain language.' },
    ],
  },
  {
    id: 11,
    title: 'Production operations',
    outcome: 'Package a service and choose useful signals',
    hoursTarget: 1,
    reading: [
      {
        title: 'Docker · Build and share an application',
        detail: 'Read what images, containers, Dockerfiles, ports, and build commands do.',
        url: 'https://docs.docker.com/get-started/tutorials/run-an-app/',
      },
      {
        title: 'Google SRE · Monitoring distributed systems',
        detail: 'Read “Why Monitor?” and the four golden signals: latency, traffic, errors, and saturation.',
        url: 'https://sre.google/sre-book/monitoring-distributed-systems/',
      },
    ],
    tasks: [
      { id: 'container-plan', title: 'Write a minimal container plan', detail: 'List the base image, install step, start command, port, and health endpoint.' },
      { id: 'signal-plan', title: 'Choose four service signals', detail: 'Name one latency, traffic, error, and saturation metric for the inference API.' },
    ],
  },
  {
    id: 12,
    title: 'Capstone',
    outcome: 'Turn the twelve sprints into a clear project plan',
    hoursTarget: 1,
    reading: [
      {
        title: 'GitHub Docs · About READMEs',
        detail: 'Read what a README should explain: purpose, usefulness, setup, help, and maintenance.',
        url: 'https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes',
      },
      {
        title: 'Google SRE · Effective troubleshooting',
        detail: 'Skim the Examine section for a practical way to use metrics, logs, and system state.',
        url: 'https://sre.google/sre-book/effective-troubleshooting/',
      },
    ],
    tasks: [
      { id: 'repo-outline', title: 'Create the README outline', detail: 'Add purpose, architecture, setup, one benchmark table, limitations, and next steps.' },
      { id: 'demo-outline', title: 'Write a five-minute demo script', detail: 'Show one request, one metric, one optimization comparison, and one failure you can explain.' },
    ],
  },
]

const javaStages: Stage[] = [
  {
    id: 1,
    title: 'Modern Java foundations',
    outcome: 'Write, run, debug, and test a small Java program',
    hoursTarget: 1,
    tools: ['JDK 21+', 'IntelliJ IDEA', 'JShell', 'Git'],
    signal: 'Core Java is the non-negotiable base in the reviewed backend roles; interview guides also expect syntactically correct, maintainable code.',
    reading: [
      {
        title: 'Dev.java · Getting started',
        detail: 'Read the JDK, JShell, source-file launch, and IDE setup sections.',
        url: 'https://dev.java/learn/getting-started/',
      },
      {
        title: 'Dev.java · Language basics',
        detail: 'Read variables, operators, expressions, control flow, and methods. Skip annotations for now.',
        url: 'https://dev.java/learn/language-basics/',
      },
    ],
    tasks: [
      { id: 'java-cli', title: 'Build a small CLI program', detail: 'Read arguments, validate input, call two methods, and print a useful result.' },
      { id: 'java-debug', title: 'Debug one failure', detail: 'Set a breakpoint, inspect variables, fix the bug, and rerun from the terminal.' },
    ],
  },
  {
    id: 2,
    title: 'OOP & clean design',
    outcome: 'Model a small domain without creating tangled classes',
    hoursTarget: 1,
    tools: ['Records', 'Interfaces', 'Enums', 'IntelliJ diagrams'],
    signal: 'Java roles repeatedly ask for object-oriented concepts, design patterns, code review, maintainability, and architecture judgment.',
    reading: [
      {
        title: 'Dev.java · Classes and objects',
        detail: 'Read constructors, access control, instance versus class members, and records.',
        url: 'https://dev.java/learn/classes-objects/',
      },
      {
        title: 'Dev.java · Inheritance and interfaces',
        detail: 'Read interfaces, inheritance, overriding, and polymorphism; focus on when composition is simpler.',
        url: 'https://dev.java/learn/inheritance/',
      },
    ],
    tasks: [
      { id: 'domain-model', title: 'Model an order domain', detail: 'Create Order, OrderItem, Money, and OrderStatus with clear responsibilities.' },
      { id: 'design-explain', title: 'Explain two design choices', detail: 'State where you used immutability or an interface and what problem it prevents.' },
    ],
  },
  {
    id: 3,
    title: 'Collections, generics & streams',
    outcome: 'Transform data safely with the Java standard library',
    hoursTarget: 1,
    tools: ['List/Set/Map', 'Generics', 'Streams', 'Optional'],
    signal: 'Strong command of the language and data structures supports both daily backend work and coding interviews.',
    reading: [
      {
        title: 'Dev.java · Collections Framework',
        detail: 'Read choosing List, Set, and Map plus iteration and immutable collection factories.',
        url: 'https://dev.java/learn/api/collections-framework/',
      },
      {
        title: 'Dev.java · Stream API',
        detail: 'Read map, filter, reduce, collectors, and why streams should avoid hidden side effects.',
        url: 'https://dev.java/learn/api/streams/',
      },
    ],
    tasks: [
      { id: 'collection-choice', title: 'Choose the right collection', detail: 'Deduplicate users, index them by ID, and keep a stable display order.' },
      { id: 'stream-report', title: 'Create one stream report', detail: 'Filter paid orders, group by customer, and total their values.' },
    ],
  },
  {
    id: 4,
    title: 'JVM, concurrency & performance',
    outcome: 'Reason about threads, memory, and a slow Java process',
    hoursTarget: 1,
    tools: ['JFR', 'jcmd', 'jstack', 'VisualVM', 'CompletableFuture'],
    signal: 'Senior postings emphasize concurrency, high throughput, low latency, troubleshooting, and performance tuning.',
    reading: [
      {
        title: 'Oracle · Java concurrency',
        detail: 'Read threads, synchronization, executors, and concurrent collections. Note race conditions and visibility.',
        url: 'https://docs.oracle.com/javase/tutorial/essential/concurrency/',
      },
      {
        title: 'Oracle · Java Flight Recorder',
        detail: 'Read what JFR records and how recordings help investigate CPU, allocation, locks, and latency.',
        url: 'https://docs.oracle.com/en/java/javase/21/jfapi/',
      },
    ],
    tasks: [
      { id: 'race-condition', title: 'Reproduce a race condition', detail: 'Increment shared state from multiple tasks, then fix it with an appropriate concurrency primitive.' },
      { id: 'jvm-observe', title: 'Inspect one running JVM', detail: 'Capture a thread dump or short JFR recording and identify one useful signal.' },
    ],
  },
  {
    id: 5,
    title: 'DSA & coding interviews',
    outcome: 'Solve and explain a timed coding problem in Java',
    hoursTarget: 1,
    tools: ['HashMap', 'Deque', 'PriorityQueue', 'HackerRank/LeetCode'],
    signal: 'Amazon and Microsoft explicitly assess data structures, algorithms, clean code, edge cases, complexity, and testing.',
    reading: [
      {
        title: 'Amazon · Software development interview topics',
        detail: 'Read programming language, data structures, algorithms, coding, OOD, databases, and distributed computing.',
        url: 'https://amazon.jobs/content/en-gb/how-we-hire/interview-prep/software-development-topics',
      },
      {
        title: 'Microsoft · Technical interviewing',
        detail: 'Read the coding, testing, and design expectations; notice the emphasis on planning and runnable code.',
        url: 'https://careers.microsoft.com/v2/global/en/hiring-tips/technical-interviewing',
      },
    ],
    tasks: [
      { id: 'timed-problem', title: 'Solve one medium problem', detail: 'Clarify requirements, write compilable Java, test edge cases, and state time and space complexity.' },
      { id: 'review-solution', title: 'Review the solution aloud', detail: 'Explain collection choices, correctness, alternatives, and how you would improve readability.' },
    ],
  },
  {
    id: 6,
    title: 'SQL & data modeling',
    outcome: 'Design and query a transactional relational model',
    hoursTarget: 1,
    tools: ['PostgreSQL', 'psql', 'EXPLAIN', 'Flyway/Liquibase'],
    signal: 'Reviewed roles call for RDBMS knowledge, schema design, migrations, query tuning, and transaction understanding.',
    reading: [
      {
        title: 'PostgreSQL · SQL tutorial',
        detail: 'Read tables, joins, aggregates, updates, foreign keys, and transactions.',
        url: 'https://www.postgresql.org/docs/current/tutorial.html',
      },
      {
        title: 'PostgreSQL · Indexes',
        detail: 'Read why indexes help lookups, what they cost on writes, and how multicolumn order matters.',
        url: 'https://www.postgresql.org/docs/current/indexes.html',
      },
    ],
    tasks: [
      { id: 'schema-design', title: 'Model orders and payments', detail: 'Create keys, constraints, and one index for a clearly stated query.' },
      { id: 'query-plan', title: 'Read one query plan', detail: 'Run EXPLAIN before and after an index and describe the changed access path.' },
    ],
  },
  {
    id: 7,
    title: 'Spring Core & Spring Boot',
    outcome: 'Start a Spring Boot service and explain dependency injection',
    hoursTarget: 1,
    tools: ['Spring Boot', 'Spring DI', 'Maven/Gradle', 'Actuator'],
    signal: 'Spring Boot and the Spring Framework appear throughout the reviewed Java backend postings.',
    reading: [
      {
        title: 'Spring Boot · First application',
        detail: 'Read project setup, the application class, controller, running, and packaging the service.',
        url: 'https://docs.spring.io/spring-boot/tutorial/first-application/index.html',
      },
      {
        title: 'Spring Framework · Beans and DI',
        detail: 'Read container, bean, constructor injection, scope, and configuration basics.',
        url: 'https://docs.spring.io/spring-framework/reference/core/beans.html',
      },
    ],
    tasks: [
      { id: 'boot-service', title: 'Create a Boot service', detail: 'Generate a project, add one controller and service, then run it from the build tool.' },
      { id: 'di-explain', title: 'Trace one dependency', detail: 'Follow controller → service → repository and explain how constructor injection wires them.' },
    ],
  },
  {
    id: 8,
    title: 'REST APIs, validation & security',
    outcome: 'Build a predictable, validated, secured API boundary',
    hoursTarget: 1,
    tools: ['Spring MVC', 'Bean Validation', 'Spring Security', 'OpenAPI', 'curl/Postman'],
    signal: 'REST, HTTP, API security, OAuth/OIDC, validation, and secure-by-design practices recur in enterprise roles.',
    reading: [
      {
        title: 'Spring · Building a REST service',
        detail: 'Read request mapping, JSON responses, parameters, and the application bootstrap.',
        url: 'https://spring.io/guides/gs/rest-service',
      },
      {
        title: 'Spring Security · Architecture',
        detail: 'Read filters, authentication, authorization, SecurityContext, and the filter chain.',
        url: 'https://docs.spring.io/spring-security/reference/servlet/architecture.html',
      },
    ],
    tasks: [
      { id: 'rest-contract', title: 'Create one CRUD endpoint', detail: 'Validate input, return correct status codes, and use a consistent error response.' },
      { id: 'secure-route', title: 'Protect one route', detail: 'Require authentication for a write endpoint and document who is authorized.' },
    ],
  },
  {
    id: 9,
    title: 'JPA, Hibernate & transactions',
    outcome: 'Persist data without losing control of queries or consistency',
    hoursTarget: 1,
    tools: ['Spring Data JPA', 'Hibernate', 'Flyway', 'PostgreSQL'],
    signal: 'Hibernate, ORM, SQL, migrations, and transaction handling are standard requirements in Java enterprise roles.',
    reading: [
      {
        title: 'Spring · Accessing data with JPA',
        detail: 'Read entity mapping, repositories, IDs, saving, and querying.',
        url: 'https://spring.io/guides/gs/accessing-data-jpa',
      },
      {
        title: 'Spring Framework · Transaction management',
        detail: 'Read transaction boundaries, @Transactional, rollback, and propagation at a high level.',
        url: 'https://docs.spring.io/spring-framework/reference/data-access/transaction.html',
      },
    ],
    tasks: [
      { id: 'jpa-model', title: 'Persist one aggregate', detail: 'Map Order and OrderItem, add a migration, and load the aggregate through a repository.' },
      { id: 'transaction-case', title: 'Protect one transaction', detail: 'Update inventory and create an order in one boundary; test that a failure rolls back both.' },
    ],
  },
  {
    id: 10,
    title: 'Testing & code quality',
    outcome: 'Test behavior from unit level through the database boundary',
    hoursTarget: 1,
    tools: ['JUnit 5', 'Mockito', 'AssertJ', 'Testcontainers', 'JaCoCo', 'SonarQube'],
    signal: 'Postings call for automated testing, TDD/BDD, code quality, CI checks, and ownership of reliable changes.',
    reading: [
      {
        title: 'Spring · Testing the web layer',
        detail: 'Read focused MVC tests, application-context tests, and MockMvc assertions.',
        url: 'https://spring.io/guides/gs/testing-web',
      },
      {
        title: 'Testcontainers · JUnit 5 quickstart',
        detail: 'Read container lifecycle, real dependency setup, and test integration.',
        url: 'https://java.testcontainers.org/quickstart/junit_5_quickstart/',
      },
    ],
    tasks: [
      { id: 'test-pyramid', title: 'Add three useful tests', detail: 'Write one unit test, one controller test, and one PostgreSQL integration test.' },
      { id: 'failure-test', title: 'Test a failure path', detail: 'Cover invalid input, a missing record, or a database constraint—not only the happy path.' },
    ],
  },
  {
    id: 11,
    title: 'Microservices & distributed design',
    outcome: 'Define service boundaries and failure-aware interactions',
    hoursTarget: 1,
    tools: ['Spring Cloud', 'OpenFeign', 'API Gateway', 'Resilience4j'],
    signal: 'Microservices, distributed systems, scalability, reliability, and API-first design are core hiring signals across the reviewed roles.',
    reading: [
      {
        title: 'Spring · Microservices',
        detail: 'Read service discovery, configuration, gateways, resilience, tracing, and why operations matter.',
        url: 'https://spring.io/microservices',
      },
      {
        title: 'Microsoft · Microservices architecture style',
        detail: 'Read service boundaries, independent deployment, data ownership, benefits, and tradeoffs.',
        url: 'https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/microservices',
      },
    ],
    tasks: [
      { id: 'service-boundaries', title: 'Split a small commerce system', detail: 'Define ownership for catalog, order, payment, and notification data and APIs.' },
      { id: 'failure-map', title: 'Map three failures', detail: 'Handle timeout, duplicate request, and partial downstream failure with explicit policies.' },
    ],
  },
  {
    id: 12,
    title: 'Kafka, caching & resilience',
    outcome: 'Design one reliable event-driven workflow',
    hoursTarget: 1,
    tools: ['Apache Kafka', 'Spring Kafka', 'Redis', 'Resilience4j', 'Schema Registry'],
    signal: 'Kafka and event-driven architectures are frequent requirements; caching and resilience patterns support the expected throughput and availability.',
    reading: [
      {
        title: 'Apache Kafka · Introduction',
        detail: 'Read events, topics, partitions, producers, consumers, ordering, and consumer groups.',
        url: 'https://kafka.apache.org/documentation/#introduction',
      },
      {
        title: 'Spring for Apache Kafka · Reference',
        detail: 'Read the overview, message listeners, transactions, and exactly-once semantics at a high level.',
        url: 'https://docs.spring.io/spring-kafka/reference/',
      },
    ],
    tasks: [
      { id: 'event-flow', title: 'Design an order event flow', detail: 'Choose the event key, partitioning rule, consumer group, retry policy, and dead-letter handling.' },
      { id: 'idempotent-consumer', title: 'Make one consumer idempotent', detail: 'Store processed event IDs or use a business key so replay does not duplicate the result.' },
    ],
  },
  {
    id: 13,
    title: 'Build tools & CI/CD',
    outcome: 'Turn a commit into a tested, versioned build',
    hoursTarget: 1,
    tools: ['Git', 'Maven/Gradle', 'GitHub Actions', 'Jenkins', 'SonarQube'],
    signal: 'CI/CD pipelines, Git workflows, automated quality checks, and continuous delivery appear across backend and platform postings.',
    reading: [
      {
        title: 'Apache Maven · Getting started',
        detail: 'Read project layout, POM, dependencies, lifecycle phases, tests, packaging, and plugins.',
        url: 'https://maven.apache.org/guides/getting-started/',
      },
      {
        title: 'GitHub Actions · Build Java with Maven',
        detail: 'Read checkout, JDK setup, dependency caching, build, test, and artifact upload.',
        url: 'https://docs.github.com/en/actions/tutorials/build-and-test-code/java-with-maven',
      },
    ],
    tasks: [
      { id: 'repro-build', title: 'Create a reproducible build', detail: 'Run clean verify from a fresh checkout and produce a versioned executable artifact.' },
      { id: 'ci-pipeline', title: 'Add one CI workflow', detail: 'Compile, test, report coverage, and fail on a broken quality gate.' },
    ],
  },
  {
    id: 14,
    title: 'Docker, Kubernetes & Helm',
    outcome: 'Package and run a Spring service as a container workload',
    hoursTarget: 1,
    tools: ['Docker', 'Docker Compose', 'Kubernetes', 'kubectl', 'Helm'],
    signal: 'Docker, Kubernetes, Helm, container orchestration, deployment automation, and scaling are prominent in current cloud-native Java roles.',
    reading: [
      {
        title: 'Docker · Containerize a Java application',
        detail: 'Read Dockerfile layers, build context, image build, container run, ports, and multi-stage builds.',
        url: 'https://docs.docker.com/guides/java/containerize/',
      },
      {
        title: 'Kubernetes · Learn the basics',
        detail: 'Read deploy, expose, scale, update, and debug. Focus on pods, deployments, services, and configuration.',
        url: 'https://kubernetes.io/docs/tutorials/kubernetes-basics/',
      },
    ],
    tasks: [
      { id: 'containerize', title: 'Containerize the service', detail: 'Build a non-root image, expose the application port, and add a health check.' },
      { id: 'k8s-manifest', title: 'Create a local deployment', detail: 'Define Deployment and Service resources with probes, limits, and environment configuration.' },
    ],
  },
  {
    id: 15,
    title: 'Cloud, IaC & observability',
    outcome: 'Describe how the service is provisioned and operated',
    hoursTarget: 1,
    tools: ['AWS/Azure/GCP', 'Terraform', 'OpenTelemetry', 'Prometheus', 'Grafana', 'ELK'],
    signal: 'Cloud, infrastructure as code, metrics, logs, traces, incident readiness, and operational ownership are repeated hiring requirements.',
    reading: [
      {
        title: 'HashiCorp · Terraform tutorials',
        detail: 'Read providers, resources, plan, apply, state, variables, outputs, and modules.',
        url: 'https://developer.hashicorp.com/terraform/tutorials',
      },
      {
        title: 'OpenTelemetry · Java instrumentation',
        detail: 'Read traces, metrics, logs, automatic instrumentation, context propagation, and exporting telemetry.',
        url: 'https://opentelemetry.io/docs/languages/java/',
      },
    ],
    tasks: [
      { id: 'cloud-map', title: 'Map one cloud deployment', detail: 'Choose one cloud and name compute, database, network, secret, and load-balancing services.' },
      { id: 'telemetry-plan', title: 'Define an operations view', detail: 'Choose latency, traffic, errors, saturation, one trace, and one actionable alert.' },
    ],
  },
  {
    id: 16,
    title: 'System design, interviews & capstone',
    outcome: 'Present a production-minded Java service under interview pressure',
    hoursTarget: 1,
    tools: ['Architecture diagrams', 'OpenAPI', 'Gatling/k6', 'GitHub', 'STAR stories'],
    signal: 'Experienced interviews combine coding, object-oriented and system design, databases, testing, tradeoffs, and evidence of ownership and communication.',
    reading: [
      {
        title: 'Amazon · SDE II interview prep',
        detail: 'Read coding, system design, testing, scalability, reliability, and behavioral expectations.',
        url: 'https://amazon.jobs/content/en/how-we-hire/sde-ii-interview-prep',
      },
      {
        title: 'Microsoft · Technical interviewing',
        detail: 'Revisit design, coding, testing, distributed systems, and the 45-minute problem-solving approach.',
        url: 'https://careers.microsoft.com/v2/global/en/hiring-tips/technical-interviewing',
      },
    ],
    tasks: [
      { id: 'system-design', title: 'Design an order platform', detail: 'Cover APIs, data, caching, Kafka, consistency, scaling, security, observability, and failures.' },
      { id: 'project-story', title: 'Prepare the capstone story', detail: 'Explain architecture, one hard tradeoff, one production failure, one measured improvement, and your ownership.' },
    ],
  },
]

const trackDefinitions: Record<TrackId, { label: string; description: string; stages: Stage[] }> = {
  inference: {
    label: 'Inference engineering',
    description: 'Beginner-first AI and inference orientation, from Python to a production capstone.',
    stages: inferenceStages,
  },
  java: {
    label: 'Java backend & DevOps',
    description: 'Role-aligned Java, Spring Boot, distributed systems, DevOps, cloud, and interview preparation.',
    stages: javaStages,
  },
}

function emptyTrackerState(stages: Stage[]): TrackerState {
  return Object.fromEntries(
    stages.map((stage) => [stage.id, { completed: [], hours: 0, notes: '' }]),
  )
}

function demoTrackerState(): PersistedTracker {
  const inference = emptyTrackerState(inferenceStages)
  for (const stage of inferenceStages.slice(0, 4)) {
    inference[stage.id] = {
      completed: stage.tasks.map((task) => task.id),
      hours: stage.hoursTarget,
      notes: '',
    }
  }
  inference[5] = {
    completed: ['generation-compare'],
    hours: 0.5,
    notes: 'Next: compare the same output length with a longer prompt.',
  }
  return {
    version: 3,
    tracks: { inference, java: emptyTrackerState(javaStages) },
    activeStages: { inference: 5, java: 1 },
    selectedTrack: 'inference',
  }
}

function normalizeTrackerState(value: unknown, stages: Stage[]): TrackerState {
  const parsed = value && typeof value === 'object' ? value as Partial<TrackerState> : {}
  const fallback = emptyTrackerState(stages)
  for (const stage of stages) {
    const saved = parsed[stage.id]
    if (!saved) continue
    const validTaskIds = new Set(stage.tasks.map((task) => task.id))
    fallback[stage.id] = {
      completed: Array.isArray(saved.completed)
        ? [...new Set(saved.completed.filter((id) => validTaskIds.has(id)))]
        : [],
      hours: Number.isFinite(saved.hours) ? clamp(saved.hours as number, 0, stage.hoursTarget) : 0,
      notes: typeof saved.notes === 'string' ? saved.notes.slice(0, 500) : '',
    }
  }
  return fallback
}

function normalizePersistedTracker(value: unknown, legacyActiveStage = 1): PersistedTracker {
  const input = value && typeof value === 'object' ? value as Partial<PersistedTracker> : {}
  const hasTracks = input.tracks && typeof input.tracks === 'object'
  const selectedTrack: TrackId = input.selectedTrack === 'java' ? 'java' : 'inference'

  if (hasTracks) {
    return {
      version: 3,
      tracks: {
        inference: normalizeTrackerState(input.tracks?.inference, inferenceStages),
        java: normalizeTrackerState(input.tracks?.java, javaStages),
      },
      activeStages: {
        inference: clamp(Number(input.activeStages?.inference) || 1, 1, inferenceStages.length),
        java: clamp(Number(input.activeStages?.java) || 1, 1, javaStages.length),
      },
      selectedTrack,
    }
  }

  return {
    version: 3,
    tracks: {
      inference: normalizeTrackerState(value, inferenceStages),
      java: emptyTrackerState(javaStages),
    },
    activeStages: {
      inference: clamp(legacyActiveStage, 1, inferenceStages.length),
      java: 1,
    },
    selectedTrack: 'inference',
  }
}

const accountStorageKey = (userId: string) => `${STORAGE_KEY}:${userId}`
const accountResetKey = (userId: string) => `${RESET_PENDING_KEY}:${userId}`

function loadTrackerState(isDemo: boolean, userId: string): PersistedTracker {
  if (isDemo) return demoTrackerState()
  try {
    const stored = window.localStorage.getItem(accountStorageKey(userId))
    if (stored) return normalizePersistedTracker(JSON.parse(stored))

    const preAuthState = window.localStorage.getItem(STORAGE_KEY)
    if (preAuthState) return normalizePersistedTracker(JSON.parse(preAuthState))

    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    const legacyActiveStage = Number(window.localStorage.getItem(ACTIVE_STAGE_KEY)) || 1
    return legacy
      ? normalizePersistedTracker(JSON.parse(legacy), legacyActiveStage)
      : normalizePersistedTracker(null)
  } catch {
    return normalizePersistedTracker(null)
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
const stageCode = (stage: number) => String(stage).padStart(2, '0')

function getInitialTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

type TrackerAppProps = {
  user: SignedInUser
  onSignOut: () => Promise<void>
}

function HeaderSignalTrace() {
  return (
    <svg className="topline-signal-field" viewBox="0 0 1200 180" preserveAspectRatio="none" aria-hidden="true">
      <path className="topline-signal-baseline" d="M0 128 H1200" />
      <path
        className="topline-signal-path topline-signal-path-ghost"
        d="M0 116 L84 116 L116 82 L172 82 L204 128 L276 128 L314 62 L356 62 L402 112 L470 112 L506 94 L564 94 L606 40 L660 40 L704 116 L770 116 L810 76 L878 76 L916 126 L986 126 L1026 98 L1092 98 L1134 54 L1200 54"
      />
      <path
        className="topline-signal-path topline-signal-path-live"
        pathLength="100"
        d="M0 116 L84 116 L116 82 L172 82 L204 128 L276 128 L314 62 L356 62 L402 112 L470 112 L506 94 L564 94 L606 40 L660 40 L704 116 L770 116 L810 76 L878 76 L916 126 L986 126 L1026 98 L1092 98 L1134 54 L1200 54"
      />
      <g className="topline-signal-nodes">
        <circle cx="116" cy="82" r="4" />
        <circle cx="314" cy="62" r="4" />
        <circle className="is-current" cx="606" cy="40" r="5" />
        <circle cx="810" cy="76" r="4" />
        <circle cx="1134" cy="54" r="4" />
      </g>
    </svg>
  )
}

function TrackerApp({ user, onSignOut }: TrackerAppProps) {
  const isDemo = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo')
  const [progress, setProgress] = useState<PersistedTracker>(() => loadTrackerState(isDemo, user.id))
  const [showReset, setShowReset] = useState(false)
  const [isHydrated, setIsHydrated] = useState(isDemo)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(isDemo ? 'demo' : 'loading')
  const [syncAttempt, setSyncAttempt] = useState(0)
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [accountError, setAccountError] = useState('')
  const [primarySection, setPrimarySection] = useState<PrimarySection>('roadmap')
  const selectedTrack = progress.selectedTrack
  const trackDefinition = trackDefinitions[selectedTrack]
  const stages = trackDefinition.stages
  const tracker = progress.tracks[selectedTrack]
  const activeStage = progress.activeStages[selectedTrack]
  const activeStageDefinition = stages.find((stage) => stage.id === activeStage) ?? stages[0]

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem(THEME_KEY, theme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      theme === 'dark' ? '#111613' : '#f7f7f4',
    )
  }, [theme])

  useEffect(() => {
    if (isDemo) return

    let cancelled = false
    const loadFromNeon = async () => {
      if (!API_URL) {
        setSyncStatus('local')
        setIsHydrated(true)
        return
      }

      if (window.localStorage.getItem(accountResetKey(user.id))) {
        setSyncStatus('saving')
        setIsHydrated(true)
        return
      }

      try {
        const token = await getAccessToken()
        const response = await fetch(`${API_URL}/state`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (response.status === 401) {
          await onSignOut()
          return
        }
        if (response.ok) {
          const remote = await response.json() as { state?: unknown; activeStage?: unknown }
          if (!cancelled) {
            const legacyActiveStage = typeof remote.activeStage === 'number'
              ? Math.round(remote.activeStage)
              : 1
            setProgress(normalizePersistedTracker(remote.state, legacyActiveStage))
          }
        } else if (response.status !== 404) {
          throw new Error(`Neon returned ${response.status}`)
        }
        if (!cancelled) setSyncStatus('saved')
      } catch (error) {
        if (error instanceof AuthSessionError) {
          await onSignOut().catch(() => {
            if (!cancelled) setSyncStatus('offline')
          })
          return
        }
        if (!cancelled) setSyncStatus('offline')
      } finally {
        if (!cancelled) setIsHydrated(true)
      }
    }

    void loadFromNeon()
    return () => { cancelled = true }
  }, [isDemo, user.id])

  useEffect(() => {
    if (isDemo || !isHydrated) return

    window.localStorage.setItem(accountStorageKey(user.id), JSON.stringify(progress))
    window.localStorage.removeItem(STORAGE_KEY)
    window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    window.localStorage.removeItem(ACTIVE_STAGE_KEY)
    if (!API_URL) {
      setSyncStatus('local')
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setSyncStatus('saving')
      try {
        const token = await getAccessToken()
        const response = await fetch(`${API_URL}/state`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ state: progress, activeStage }),
          signal: controller.signal,
        })
        if (response.status === 401) {
          await onSignOut()
          return
        }
        if (!response.ok) throw new Error(`Neon returned ${response.status}`)
        window.localStorage.removeItem(accountResetKey(user.id))
        setSyncStatus('saved')
      } catch (error) {
        if (error instanceof AuthSessionError) {
          await onSignOut().catch(() => setSyncStatus('offline'))
          return
        }
        if ((error as Error).name !== 'AbortError') {
          setSyncStatus('offline')
        }
      }
    }, 500)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [activeStage, isDemo, isHydrated, progress, syncAttempt, user.id])

  useEffect(() => {
    if (isDemo) return
    const retryQueuedChanges = () => setSyncAttempt((attempt) => attempt + 1)
    window.addEventListener('online', retryQueuedChanges)
    return () => window.removeEventListener('online', retryQueuedChanges)
  }, [isDemo])

  const totalTasks = useMemo(() => stages.reduce((sum, stage) => sum + stage.tasks.length, 0), [stages])
  const completedTasks = useMemo(
    () => stages.reduce((sum, stage) => sum + tracker[stage.id].completed.length, 0),
    [stages, tracker],
  )
  const overallProgress = Math.round((completedTasks / totalTasks) * 100)
  const progressForTrack = (trackId: TrackId) => {
    const trackStages = trackDefinitions[trackId].stages
    const total = trackStages.reduce((sum, stage) => sum + stage.tasks.length, 0)
    const completed = trackStages.reduce(
      (sum, stage) => sum + progress.tracks[trackId][stage.id].completed.length,
      0,
    )
    return Math.round((completed / total) * 100)
  }
  const syncLabel: Record<SyncStatus, string> = {
    loading: 'Loading Neon progress…',
    saving: 'Saving to Neon…',
    saved: 'Saved to Neon',
    offline: 'Offline · changes queued',
    local: 'Neon API not configured',
    demo: 'Demo data',
  }

  const updateStage = (stageId: number, update: Partial<StageState>) => {
    setProgress((current) => ({
      ...current,
      tracks: {
        ...current.tracks,
        [selectedTrack]: {
          ...current.tracks[selectedTrack],
          [stageId]: { ...current.tracks[selectedTrack][stageId], ...update },
        },
      },
    }))
  }

  const selectStage = (stageId: number) => {
    setProgress((current) => ({
      ...current,
      activeStages: { ...current.activeStages, [selectedTrack]: stageId },
    }))
  }

  const scrollToStage = (trackId: TrackId, stageId: number) => {
    window.requestAnimationFrame(() => {
      document.getElementById(`stage-${trackId}-${stageId}`)?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      })
    })
  }

  const selectTrack = (trackId: TrackId, revealStage = false) => {
    setShowReset(false)
    setProgress((current) => ({ ...current, selectedTrack: trackId }))
    if (revealStage) {
      window.setTimeout(() => scrollToStage(trackId, progress.activeStages[trackId]), 0)
    }
  }

  const toggleTask = (stageId: number, taskId: string) => {
    const current = tracker[stageId].completed
    const completed = current.includes(taskId)
      ? current.filter((id) => id !== taskId)
      : [...current, taskId]
    updateStage(stageId, { completed })
  }

  const resetProgress = () => {
    if (API_URL) window.localStorage.setItem(accountResetKey(user.id), 'true')
    setProgress((current) => ({
      ...current,
      tracks: { ...current.tracks, [selectedTrack]: emptyTrackerState(stages) },
      activeStages: { ...current.activeStages, [selectedTrack]: 1 },
    }))
    setShowReset(false)
    setSyncStatus(API_URL ? 'saving' : 'local')
  }

  const handleSignOut = async () => {
    if (isSigningOut) return
    setAccountError('')
    setIsSigningOut(true)
    try {
      await onSignOut()
    } catch {
      setAccountError('Sign out did not complete. Check your connection and try again.')
      setIsSigningOut(false)
    }
  }

  const controlsDisabled = !isHydrated && !isDemo

  return (
    <main className="app-shell" aria-busy={controlsDisabled}>
      <header className="topline">
        <HeaderSignalTrace />
        <div className="brand-block">
          <h1>Inference Engineering</h1>
          <p>Inference + Java backend</p>
        </div>

        {primarySection === 'roadmap' ? (
          <div className="overall-block">
            <div className="measure-label">
              <span>{overallProgress}% complete</span>
            </div>
            <progress value={completedTasks} max={totalTasks} aria-label={`${overallProgress}% complete`} />
          </div>
        ) : primarySection === 'vault' ? (
          <div className="overall-block vault-overall-block">
            <div className="measure-label"><span>Personal vault</span></div>
            <p>Links · prompts · projects · text</p>
          </div>
        ) : primarySection === 'english' ? (
          <div className="overall-block vault-overall-block">
            <div className="measure-label"><span>English clarity</span></div>
            <p>30 days · pronunciation · workplace speech</p>
          </div>
        ) : primarySection === 'planner' ? (
          <div className="overall-block vault-overall-block">
            <div className="measure-label"><span>Weekend planner</span></div>
            <p>Saturday · Sunday · Hyderabad</p>
          </div>
        ) : (
          <div className="overall-block vault-overall-block">
            <div className="measure-label"><span>Personal schedule</span></div>
            <p>Dates · appointments · tasks</p>
          </div>
        )}

        <div className="current-block">
          <p>{primarySection === 'roadmap'
            ? <>Current · {selectedTrack === 'inference' ? 'AI' : 'Java'} · stage {stageCode(activeStage)}</>
            : primarySection === 'vault'
              ? <>Personal · private vault</>
              : primarySection === 'english'
                ? <>Practice · 45 minutes daily</>
                : primarySection === 'planner'
                  ? <>Plan · free weekends</>
                  : <>Schedule · your dates and plans</>}</p>
          <div className="account-controls">
            <span className="account-email" title={user.email}>{user.email}</span>
            <button
              className="sign-out-button"
              type="button"
              disabled={isSigningOut}
              aria-describedby={accountError ? 'account-error' : undefined}
              onClick={() => void handleSignOut()}
            >
              {isSigningOut ? 'Signing out…' : 'Sign out'}
            </button>
            <button
              className="theme-toggle"
              type="button"
              aria-label={`Dark mode ${theme === 'dark' ? 'on' : 'off'}`}
              aria-pressed={theme === 'dark'}
              onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
            >
              <span>Dark mode</span>
              <span className="theme-switch" aria-hidden="true">
                <span />
              </span>
            </button>
          </div>
          {accountError && <span className="account-error" id="account-error" role="alert">{accountError}</span>}
        </div>
      </header>

      <nav className="primary-section-switcher" aria-label="Main sections">
        <button
          type="button"
          className={primarySection === 'roadmap' ? 'is-active' : ''}
          aria-pressed={primarySection === 'roadmap'}
          onClick={() => setPrimarySection('roadmap')}
        >
          <strong>Engineering roadmap</strong><span>28 one-hour sprints</span>
        </button>
        <button
          type="button"
          className={primarySection === 'vault' ? 'is-active' : ''}
          aria-pressed={primarySection === 'vault'}
          onClick={() => setPrimarySection('vault')}
        >
          <strong>Personal vault</strong><span>Private notes and references</span>
        </button>
        <button
          type="button"
          className={primarySection === 'english' ? 'is-active' : ''}
          aria-pressed={primarySection === 'english'}
          onClick={() => setPrimarySection('english')}
        >
          <strong>English clarity</strong><span>30-day speaking practice</span>
        </button>
        <button
          type="button"
          className={primarySection === 'planner' ? 'is-active' : ''}
          aria-pressed={primarySection === 'planner'}
          onClick={() => setPrimarySection('planner')}
        >
          <strong>Weekend planner</strong><span>Tasks and free local events</span>
        </button>
        <button
          type="button"
          className={primarySection === 'schedule' ? 'is-active' : ''}
          aria-pressed={primarySection === 'schedule'}
          onClick={() => setPrimarySection('schedule')}
        >
          <strong>My schedule</strong><span>All dates, tasks, and plans</span>
        </button>
      </nav>

      {primarySection === 'roadmap' ? (
        <>
          <span className={`sync-status is-${syncStatus}`} role="status" aria-live="polite">
            {syncLabel[syncStatus]}
          </span>

      <nav className="track-switcher" aria-label="Learning tracks" role="tablist">
        {(Object.keys(trackDefinitions) as TrackId[]).map((trackId, index) => {
          const definition = trackDefinitions[trackId]
          const isSelected = selectedTrack === trackId
          return (
            <button
              id={`track-tab-${trackId}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls="roadmap-ledger"
              className={isSelected ? 'is-selected' : ''}
              key={trackId}
              onClick={() => selectTrack(trackId)}
            >
              <span className="track-index">Track {stageCode(index + 1)}</span>
              <strong>{definition.label}</strong>
              <span>{definition.stages.length} × 1h sprints</span>
              <span className="track-progress">{progressForTrack(trackId)}%</span>
            </button>
          )
        })}
      </nav>

      <div className="track-context">
        <p>{trackDefinition.description}</p>
        <p>Each hour is an orientation sprint. Repeat difficult stages until you can complete the exercises without copying.</p>
      </div>

      <section
        className="ledger"
        id="roadmap-ledger"
        role="tabpanel"
        aria-labelledby={`track-tab-${selectedTrack}`}
        aria-label={`${stages.length}-stage ${trackDefinition.label} roadmap`}
      >
        <div className="ledger-head" aria-hidden="true">
          <span>Stage</span>
          <span>Focus</span>
          <span>Key outcome</span>
          <span>Status</span>
          <span>Hours</span>
          <span />
        </div>

        {stages.map((stage) => {
          const stageState = tracker[stage.id]
          const isActive = activeStage === stage.id
          const completed = stageState.completed.length
          const isComplete = completed === stage.tasks.length
          const hoursPercent = clamp((stageState.hours / stage.hoursTarget) * 100, 0, 100)

          return (
            <article
              className={`week-entry${isActive ? ' is-active' : ''}`}
              id={`stage-${selectedTrack}-${stage.id}`}
              key={stage.id}
            >
              <button
                type="button"
                className="week-row"
                aria-expanded={isActive}
                aria-controls={`stage-detail-${stage.id}`}
                disabled={controlsDisabled}
                onClick={() => selectStage(stage.id)}
              >
                <span className="week-number">{stageCode(stage.id)}</span>
                <span className="week-title">{stage.title}</span>
                <span className="week-outcome">{stage.outcome}</span>
                <span className="week-status">
                  <span className={`status-mark${isComplete ? ' is-complete' : ''}`} aria-hidden="true">
                    {isComplete && <span className="check-stroke" />}
                  </span>
                  <span>{completed} / {stage.tasks.length}</span>
                </span>
                <span className="week-hours">{stageState.hours}h / {stage.hoursTarget}h</span>
                <span className={`chevron${isActive ? ' is-open' : ''}`} aria-hidden="true" />
              </button>

              {isActive && (
                <section id={`stage-detail-${stage.id}`} className="week-detail" key={stage.id}>
                  <div className="reading-column">
                    <div className="section-heading-row">
                      <h2>Read first</h2>
                      <span>20 min</span>
                    </div>
                    {stage.tools && (
                      <p className="tool-line">
                        <span>Tools</span>
                        <strong>{stage.tools.join(' · ')}</strong>
                      </p>
                    )}
                    {stage.signal && (
                      <p className="hiring-signal">
                        <span>Hiring signal</span>
                        {stage.signal}
                      </p>
                    )}
                    <div className="reading-list">
                      {stage.reading.map((item) => (
                        <a
                          className="reading-item"
                          href={item.url}
                          key={item.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`${item.title} (opens in a new tab)`}
                        >
                          <strong>{item.title}</strong>
                          <span>{item.detail}</span>
                          <span className="reading-action">Open guide</span>
                        </a>
                      ))}
                    </div>
                  </div>

                  <div className="tasks-column">
                    <div className="section-heading-row">
                      <h2>Try it</h2>
                      <span>35 min</span>
                    </div>
                    <div className="task-list">
                      {stage.tasks.map((task) => {
                        const checked = stageState.completed.includes(task.id)
                        return (
                          <label className="task-item" key={task.id}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={controlsDisabled}
                              onChange={() => toggleTask(stage.id, task.id)}
                            />
                            <span className="custom-check" aria-hidden="true"><span className="check-stroke" /></span>
                            <span className="task-copy">
                              <strong>{task.title}</strong>
                              <span>{task.detail}</span>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <div className="pace-column">
                    <div className="hours-panel">
                      <label htmlFor={`hours-${stage.id}`}>One-hour sprint</label>
                      <div className="hours-line">
                        <strong>{stage.hoursTarget}h</strong>
                        <span className="logged-hours">
                          <input
                            id={`hours-${stage.id}`}
                            type="number"
                            min="0"
                            max={stage.hoursTarget}
                            step="0.25"
                            value={stageState.hours}
                            disabled={controlsDisabled}
                            onChange={(event) => updateStage(stage.id, { hours: clamp(Number(event.target.value), 0, stage.hoursTarget) })}
                          />
                          h logged · {Math.max(stage.hoursTarget - stageState.hours, 0)}h left
                        </span>
                      </div>
                      <progress value={hoursPercent} max="100" aria-label={`${Math.round(hoursPercent)}% of suggested stage hours logged`} />
                      <p className="sprint-note">20m reading · 35m practice · 5m notes</p>
                    </div>

                    <div className="notes-panel">
                      <label htmlFor={`notes-${stage.id}`}>Notes</label>
                      <textarea
                        id={`notes-${stage.id}`}
                        value={stageState.notes}
                        maxLength={500}
                        disabled={controlsDisabled}
                        placeholder="Decisions, bottlenecks, and the next run…"
                        onChange={(event) => updateStage(stage.id, { notes: event.target.value })}
                      />
                      <p>{stageState.notes.length} / 500</p>
                    </div>
                  </div>
                </section>
              )}
            </article>
          )
        })}
      </section>

      <footer className="app-footer">
        <div className="footer-note">
          <p>Progress is stored in Neon with a local fallback.</p>
          <div>
            <p>Learn the mechanism, then tune it.</p>
            <button
              className="reset-trigger"
              type="button"
              disabled={controlsDisabled}
              aria-expanded={showReset}
              aria-controls="reset-confirmation"
              onClick={() => setShowReset((value) => !value)}
            >
              Reset this track
            </button>
          </div>
        </div>
        {showReset && (
          <div className="reset-bar" id="reset-confirmation" role="alert">
            <p>
              Clear every checkbox, logged hour, and note in {trackDefinition.label}. If Neon is offline,
              the reset stays queued in this browser until the connection returns.
            </p>
            <div>
              <button type="button" className="button-secondary" onClick={() => setShowReset(false)}>Keep progress</button>
              <button type="button" className="button-danger" onClick={resetProgress}>Clear this track</button>
            </div>
          </div>
        )}
      </footer>

      <nav className="mobile-dock" aria-label="Quick learning controls">
        <div className="mobile-track-tabs" role="group" aria-label="Choose learning track">
          {(Object.keys(trackDefinitions) as TrackId[]).map((trackId) => (
            <button
              type="button"
              key={trackId}
              aria-pressed={selectedTrack === trackId}
              disabled={controlsDisabled}
              onClick={() => selectTrack(trackId, true)}
            >
              {trackId === 'inference' ? 'AI' : 'Java'}
            </button>
          ))}
        </div>
        <div className="mobile-current" aria-live="polite">
          <span>Current</span>
          <strong>{selectedTrack === 'inference' ? 'AI' : 'Java'} · {stageCode(activeStage)}</strong>
        </div>
        <button
          className="mobile-open-stage"
          type="button"
          disabled={controlsDisabled}
          aria-label={`Open stage ${stageCode(activeStage)}: ${activeStageDefinition.title}`}
          onClick={() => scrollToStage(selectedTrack, activeStage)}
        >
          Open stage
        </button>
      </nav>
        </>
      ) : primarySection === 'vault' ? (
        <NotesVault apiUrl={API_URL} onSessionExpired={onSignOut} demoNotes={isDemo ? vaultDemoNotes : undefined} />
      ) : primarySection === 'english' ? (
        <EnglishPractice
          apiUrl={API_URL}
          userId={user.id}
          isDemo={isDemo}
          onSessionExpired={onSignOut}
        />
      ) : primarySection === 'planner' ? (
        <WeekendPlanner
          apiUrl={API_URL}
          userId={user.id}
          isDemo={isDemo}
          onSessionExpired={onSignOut}
        />
      ) : (
        <Schedule apiUrl={API_URL} userId={user.id} isDemo={isDemo} onSessionExpired={onSignOut} />
      )}
    </main>
  )
}

function App() {
  const isDemo = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo')

  if (isDemo) {
    return (
      <TrackerApp
        user={{ id: 'demo-user', email: 'demo@engineering.track', name: 'Demo learner' }}
        onSignOut={async () => undefined}
      />
    )
  }

  return (
    <AuthGate>
      {(user, signOut) => <TrackerApp user={user} onSignOut={signOut} />}
    </AuthGate>
  )
}

export default App
