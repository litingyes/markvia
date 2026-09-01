import { createMarkdown } from '@markvia/core'
import { htmlRenderer } from '@markvia/html'

const runtime = createMarkdown()
const source = '# Markvia\n\nWrite Markdown once, render it everywhere.'

console.log(runtime.render(source, htmlRenderer))
