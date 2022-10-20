const { Octokit } = require("@octokit/rest");
const { graphql } = require("@octokit/graphql");

var args = require('minimist')(process.argv.slice(2));
console.dir(args);

var token = args.t;

const octokit = new Octokit({
    auth: token,
});

const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `token ${token}`,
    },
  });

async function getWatchedRepos(pUser) {

    const watchedRepos = await octokit.paginate(octokit.activity.listReposWatchedByUser, {
        username: pUser,
    }).catch(function (error) {
        console.log(error);
    });
    
    return watchedRepos;
    
}

async function getRepoIssues(pRepoOwner, pRepoName) {

    const repoIssues = await octokit.paginate(octokit.issues.listForRepo, {
        owner: pRepoOwner,
        repo: pRepoName
    }).catch(function (error) {
        console.log(error);
    });

    return repoIssues;

}

async function getRepoIssuesGraphQLUnique(pRepoOwner, pRepoName, pEndCursor) {

        const query = `query {
            repository(owner: "${pRepoOwner}", name: "${pRepoName}") {
                issues(first: 10, after: ${pEndCursor}) {
                    pageInfo {
                        hasNextPage
                        endCursor
                    }
                    nodes {
                        id
                        title
                        viewerSubscription
                      	author{
                          login
                        }
                      assignees(first:10){
                        edges {
                          node {
                            login
                          }
                        }
                      }
                      url
                      createdAt
                      updatedAt
                      state
                      labels(first:10){
                        nodes{
                          name
                        }
                      }
                      milestone {
                        title
                      }
                      
                      
                    }
                }
            }
        }`;

        const result = await graphqlWithAuth(query).catch(function (error) {
            console.log(error);
        });

        return result;

}

async function getRepoIssuesGraphQL(pRepoOwner, pRepoName) {

    var issues = [];
    var hasNextPage = true;
    var endCursor = null;

    while (hasNextPage) {

        var result = await getRepoIssuesGraphQLUnique(pRepoOwner, pRepoName, endCursor).catch(function (error) {
            console.log(error);
        });

        hasNextPage = result.repository.issues.pageInfo.hasNextPage;
        endCursor = '"' + result.repository.issues.pageInfo.endCursor + '"';

        result.repository.issues.nodes.forEach(issue => {
            if (issue.viewerSubscription == "SUBSCRIBED") {
            issues.push(issue);
            }
        });

    }

    return issues;

}

async function main() {

    var items = [];

    const repos = await getWatchedRepos("tdupoiron").catch(function (error) {
        console.log(error);
    });

    console.log("repos: " + repos.length);

    for (var i = 0; i < repos.length; i++) {

        currentRepo = repos[i];

        await getRepoIssuesGraphQL(currentRepo.owner.login, currentRepo.name).then(res => {
            res.forEach(issue => {

                item = {};
                item.repo = {};
                item.repo.owner = currentRepo.owner.login;
                item.repo.name = currentRepo.name;

                item.issue = {};
                item.issue.id = issue.id;
                item.issue.title = issue.title;
                item.issue.url = issue.url;
                item.issue.createdAt = issue.createdAt;
                item.issue.updatedAt = issue.updatedAt;
                item.issue.state = issue.state;
                item.issue.author = issue.author.login;
                item.issue.assignees = [];
                issue.assignees.edges.forEach(assignee => {
                    item.issue.assignees.push(assignee.node.login);
                });
                item.issue.labels = [];
                issue.labels.nodes.forEach(label => {
                    item.issue.labels.push(label.name);
                });

                items.push(item);

            });
        });

    }

    console.log(items);

}

main();