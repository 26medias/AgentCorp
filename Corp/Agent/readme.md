# Agent


## Agent Rules

- An agent can only act when requested to or when receiving a DM
- An agent generates an actions array & an internal memo for its own planning
- An agent has access to the project's metadata & specs
- An agent can read & write files in the shared workspace
- An agent can run shell commands & access their output
- An agent keep track of:
    - Channel history
    - PM history
    - Relevant context via embeddings similarity
    - Async Reply state when requesting replies from multiple users
- An agent has different prompts for different situations:
    - Channel message without action request
    - Channel message with action request
    - DM message
- When starting a new action, the agent starts with a new dedicated think-thread
- The agent is required to signal the end of its think-thread
- When replying to a requested action, the Agent needs to include the thread ID in its reply




## Actions

### Available actions:

**readFiles**

`["filename", "filename", ...]`

**writeFiles**

`[{"filename": "", "content": ""}, ...]`

**runShellCommand**

`{"command": "npm install"}`

**sendChannelMessage**

```
[
    {
        "channel": "#general",
        "message": "Review the code in `main.js`",
        "request_reply": ["userA", "userB"]
    }
]
```

**sendDM**

```
{
    "to": "username",
    "message": "Write the code for `test.js` using the specs from `test-specs.md` and report when you are done",
    "request_reply": true
}
```


### Example of response

```
{
    "threadId": "4d977bd9-8f20-4c4a-815a-dbb63ed232a2",
    "actions": [
        {
            "action": "glob",
            "data": ["*.md", "specs/**/*"]
        },
        {
            "action": "writeFiles",
            "data": [
                {
                    "filename": "test.js",
                    "content": "console.log('hello world');"
                },
                {
                    "filename": "test.md",
                    "content": "# Test\nPrints 'hello world'"
                }
            ]
        },
        {
            "action": "runShellCommand",
            "data": {
                "command": "node test.js"
            }
        },
        {
            "action": "sendChannelMessages",
            "data": [
                {
                    "channel": "#CodeReview",
                    "message": "Please review the code in `test.js`",
                    "request_reply": ["userA", "userB"]
                }
            ]
        },
        {
            "action": "sendDMs",
            "data": [
                {
                    "to": "project-manager",
                    "message": "I have written the code for `test.js` & created a markdown file to document it. I have requested a code review from userA & userB on #CodeReview",
                    "request_reply": false
                }
            ]
        },
        {
            "action": "readFiles",
            "data": ["specs.md", "main.js"]
        }
    ],
    "next_steps": "Review the output from `node test.js`, ensure it matches the specs in `specs.md` & `main.js`, ..."
}
```


### Example of output received back

```
{
    "action_outputs": [
        {
            "action": "writeFiles",
            "output": {
                "*.md": "[\"project.md\", \"specs/specs.md\"]",
                "specs/**/*": "[\"specs/specs.md\", \"specs/project.md\", \"specs/test/test.txt\"]"
            }
        },
        {
            "action": "writeFiles",
            "output": {
                "test.js": "success",
                "test.md": "success"
            }
        },
        {
            "action": "runShellCommand",
            "output": "hello world"
        },
        {
            "action": "sendChannelMessages",
            "output": true
        },
        {
            "action": "sendDMs",
            "output": true
        },
        {
            "action": "readFiles",
            "output": {
                "specs.md": "# Project Specs\n\ntodo.",
                "main.js": "const main = () => {\n    console.log('todo');\n}"
            }
        }
    ]
}
```

### Example of response to signal end-of-loop:

```
{
    "threadId": "4d977bd9-8f20-4c4a-815a-dbb63ed232a2",
    "actions": false,
    "next_steps": false
}
```


## High Level Logic

- OnMessage
    - Action not required
        - Do nothing
    - Action is Required
        - New agent thread
        - Data:
            - Channel/PM history
            - Relevant context deduplicated (remove what's in history already)
            - Thread history
- OnThread [threadId=01]
    - currentThread=01
    - Request actions from uA & uB [msgId=02]
        - threads[01] = currentThread;
        - receive messages from uA [threadId=02]
            - msgStatus not done, wait
        - receive messages from uB [threadId=02]
            - msgStatus done. 



## Scenarios

### Startup

[01][PM]>[#plot-development] @LeadWriter Come up with a plot [<threadId=01]
    [PM] sendChannelMessage()
        Wait for answer
    [LeadWriter] onMessage()
        thinkThread -> reply
        thinkThread -> End of loop
[02][LeadWriter]>[#plot-development] [plot content] [>threadId=01]
    [LeadWriter] sendChannelMessage()
        End of loop
    [PM] onMessage()
        Answer received
        All answers received
        thinkThread -> reply
        thinkThread -> End of loop
[03][PM]>[#plot-development] @ScienceExpert @CharacterDev Give us your opinion
    [PM] sendChannelMessage()
        Wait for answer
    [ScienceExpert] onMessage()
        thinkThread -> reply
        thinkThread -> End of loop
    [CharacterDev] onMessage()
        thinkThread -> reply
        thinkThread -> End of loop
[04][ScienceExpert]>[#plot-development] [opinion]
    [ScienceExpert] sendChannelMessage()
        End of loop
    [PM] onMessage()
        Answer received
        Wait for another one
[05][CharacterDev]>[#plot-development] [opinion]
    [CharacterDev] sendChannelMessage()
        End of loop
    [PM] onMessage()
        Answer received
        All answers received
        thinkThread -> reply
        thinkThread -> End of loop
[06][PM]>[#plot-development] @LeadWriter Update your plot and give us the new version
    [PM] sendChannelMessage()
        Wait for answer
    [LeadWriter] onMessage()
        thinkThread -> reply
        thinkThread -> End of loop
[07][LeadWriter]>[#plot-development] [plot content]
    [LeadWriter] sendChannelMessage()
        End of loop
    [PM] onMessage()
        Answer received
        All answers received
        thinkThread -> reply
        thinkThread -> End of loop