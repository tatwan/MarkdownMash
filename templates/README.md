# Example Mashes

Ready-to-run Markdown quizzes for Markdown Mash. These files are the
**single source of truth** for the host studio’s **Starter templates**
gallery: the app serves this folder and loads a file when you pick a card.

They also replace the old root-level `sample-quiz.md`.

## In the studio

Open **Host a Mash → Starter templates** and choose a card. The matching
file from this folder is loaded into the editor so you can edit freely
before opening the room.

## From the repository

Copy any file into the host studio editor, or start from these examples
when writing your own Mashes.

## Templates

| File | Theme | Notes |
|---|---|---|
| [`math.md`](math.md) | Quick math | Classic three-question graded Mash |
| [`python.md`](python.md) | Python basics | Sections + one ungraded opinion question |
| [`data-science.md`](data-science.md) | Data science | Classic three-question graded Mash |
| [`marvel.md`](marvel.md) | Marvel movies & TV | Classic three-question graded Mash |
| [`music.md`](music.md) | Music & lyrics | Classic three-question graded Mash |
| [`history.md`](history.md) | History highlights | Bonus section with an ungraded question |
| [`classroom-modules.md`](classroom-modules.md) | Classroom showcase | Full v1.4 demo: two sections, mixed graded/ungraded |
| [`survey-food.md`](survey-food.md) | Survey · food | Anonymous pulse (v1.5) |
| [`survey-movies.md`](survey-movies.md) | Survey · movies | Anonymous pulse (v1.5) |
| [`survey-sports.md`](survey-sports.md) | Survey · sports | Anonymous pulse (v1.5) |

## Syntax quick reference

```markdown
# Quiz Title
# Score 100

# Section: Module name
> Optional subtitle

## Q1: Graded question?
- [ ] Wrong
- [x] Right
::time=20

## Q2: Just for fun?
::type=ungraded
- [x] One
- [ ] Two
```

- `# Section: Name` announces a curtain before that module’s questions.
- `::type=ungraded` captures correctness without points or streak changes.
- `# Score N` divides points among **graded** questions only.

See the project [README](../README.md#quiz-format) for the full format guide.
